import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  NotificationCategory,
  OrderStatus,
  type OrderShippingChangeField,
  PaymentMethod,
  PaymentStatus
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { MailerService } from "../mailer/mailer.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OrderStatusHistoryService } from "../orderStatusHistory/order-status-history.service";
import { PaymentLifecycleService } from "../payments/payment-lifecycle.service";
import { PrismaService } from "../prisma/prisma.service";
import { SystemSettingsService } from "../systemSettings/system-settings.service";
import { AuditLogsService } from "../auditLogs/audit-logs.service";
import type { AuthPayload } from "../auth/types/auth-payload";
import { PaymentGatewayService } from "../payments/payment-gateway.service";
import { ListAdminOrdersDto } from "./dto/list-admin-orders.dto";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly mailerService: MailerService,
    private readonly orderStatusHistoryService: OrderStatusHistoryService,
    private readonly paymentLifecycleService: PaymentLifecycleService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly paymentGatewayService: PaymentGatewayService
  ) {}

  async listOwn(userId: string) {
    await this.paymentLifecycleService.expireStalePendingPayments({
      userId
    });

    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        payments: {
          select: {
            id: true,
            method: true,
            status: true,
            amount: true,
            referenceCode: true,
            expiresAt: true
          },
          orderBy: [{ createdAt: "desc" }]
        }
      }
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      itemsSubtotal: order.itemsSubtotal.toString(),
      shippingFee: order.shippingFee.toString(),
      discountTotal: order.discountTotal.toString(),
      grandTotal: order.grandTotal.toString(),
      appliedVoucherCodes: order.appliedVoucherCodes,
      placedAt: order.placedAt.toISOString(),
      shop: order.shop,
      payments: order.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toString(),
        expiresAt: payment.expiresAt?.toISOString() ?? null
      }))
    }));
  }

  async listAdmin(query: ListAdminOrdersDto) {
    await this.paymentLifecycleService.expireStalePendingPayments();

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.search
        ? {
            OR: [
              {
                orderNumber: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                user: {
                  is: {
                    fullName: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                user: {
                  is: {
                    email: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                shop: {
                  is: {
                    name: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              }
            ]
          }
        : {})
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true
            }
          },
          payments: {
            select: {
              id: true,
              method: true,
              status: true,
              amount: true,
              referenceCode: true,
              expiresAt: true
            },
            orderBy: [{ createdAt: "desc" }]
          }
        }
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      items: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      itemsSubtotal: order.itemsSubtotal.toString(),
      shippingFee: order.shippingFee.toString(),
      discountTotal: order.discountTotal.toString(),
      grandTotal: order.grandTotal.toString(),
      placedAt: order.placedAt.toISOString(),
      customer: order.user,
      shop: order.shop,
      payments: order.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toString(),
        expiresAt: payment.expiresAt?.toISOString() ?? null
      }))
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async getOwnDetail(userId: string, orderId: string) {
    await this.paymentLifecycleService.expireStalePendingPayments({
      orderIds: [orderId],
      userId
    });

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        items: {
          orderBy: [{ createdAt: "asc" }],
          include: {
            review: {
              select: {
                id: true
              }
            }
          }
        },
        payments: {
          orderBy: [{ createdAt: "desc" }],
          include: {
            events: {
              include: {
                actorUser: {
                  select: {
                    id: true,
                    fullName: true,
                    role: true
                  }
                }
              },
              orderBy: [{ createdAt: "asc" }]
            }
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const statusTimeline = await this.orderStatusHistoryService.listForOrder(order.id);
    const [autoCompleteDays, returnRequestWindowDays] = await Promise.all([
      this.systemSettingsService.getNumberValue("order_auto_complete_days"),
      this.systemSettingsService.getNumberValue("return_request_window_days")
    ]);
    const shippingEditable = this.canCustomerEditShipping(
      order.status as OrderStatus,
      statusTimeline
    );
    return {
      ...this.serializeOrderDetail(order),
      statusTimeline,
      latestShippingUpdate: this.extractLatestShippingUpdate(statusTimeline),
      returnWindow: this.buildReturnWindow(
        order.status as OrderStatus,
        order.updatedAt,
        statusTimeline,
        returnRequestWindowDays
      ),
      shippingUpdateWindow: {
        canEdit: shippingEditable,
        lockedReason: shippingEditable
          ? null
          : "Shipping details can only change before the seller starts handling the order."
      },
      autoCompleteWindow: this.buildAutoCompleteWindow(
        order.status as OrderStatus,
        order.updatedAt,
        statusTimeline,
        autoCompleteDays
      )
    };
  }

  async updateOwnShipping(
    userId: string,
    orderId: string,
    payload: {
      recipientName: string;
      phoneNumber: string;
      addressLine1: string;
      addressLine2?: string;
      ward?: string;
      district: string;
      province: string;
      regionCode: string;
      note?: string;
    }
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      include: {
        shop: {
          select: {
            ownerId: true,
            name: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const statusTimeline = await this.orderStatusHistoryService.listForOrder(order.id);
    if (!this.canCustomerEditShipping(order.status as OrderStatus, statusTimeline)) {
      throw new ConflictException(
        "Shipping details can only be changed before the seller handles the order"
      );
    }

    const previousAddress = {
      recipientName: order.shippingRecipientName,
      phoneNumber: order.shippingPhoneNumber,
      addressLine1: order.shippingAddressLine1,
      addressLine2: order.shippingAddressLine2,
      ward: order.shippingWard,
      district: order.shippingDistrict,
      province: order.shippingProvince,
      regionCode: order.shippingRegionCode,
      note: order.note
    };
    const nextAddress = {
      recipientName: payload.recipientName,
      phoneNumber: payload.phoneNumber,
      addressLine1: payload.addressLine1,
      addressLine2: payload.addressLine2 ?? null,
      ward: payload.ward ?? null,
      district: payload.district,
      province: payload.province,
      regionCode: payload.regionCode,
      note: payload.note?.trim() || null
    };
    const changedFields = this.buildShippingChangedFields(previousAddress, nextAddress);

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          shippingRecipientName: payload.recipientName,
          shippingPhoneNumber: payload.phoneNumber,
          shippingAddressLine1: payload.addressLine1,
          shippingAddressLine2: payload.addressLine2 ?? null,
          shippingWard: payload.ward ?? null,
          shippingDistrict: payload.district,
          shippingProvince: payload.province,
          shippingRegionCode: payload.regionCode,
          note: payload.note?.trim() || null
        }
      });

      await this.orderStatusHistoryService.record(
        {
          orderId: order.id,
          status: order.status as OrderStatus,
          actorType: "CUSTOMER",
          actorUserId: userId,
          note: "Buyer updated shipping details before seller handling",
          metadata: {
            previousAddress,
            nextAddress,
            changedFields
          }
        },
        tx
      );

      await this.auditLogsService.record(
        {
          actorUserId: userId,
          actorRole: "CUSTOMER",
          action: "orders.customer.update_shipping",
          entityType: "ORDER",
          entityId: order.id,
          summary: `Buyer updated shipping details for ${order.orderNumber}`,
          metadata: {
            orderNumber: order.orderNumber,
            previousAddress,
            nextAddress,
            changedFields
          }
        },
        tx
      );

      return nextOrder;
    });

    await this.notificationsService.create({
      userId: order.shop.ownerId,
      category: NotificationCategory.ORDER_STATUS,
      title: "Buyer updated shipping details",
      body: `${order.orderNumber} has updated delivery details before fulfillment.`,
      linkUrl: "/seller/orders"
    });

    return {
      id: updated.id,
      status: updated.status,
      shippingAddress: {
        recipientName: updated.shippingRecipientName,
        phoneNumber: updated.shippingPhoneNumber,
        addressLine1: updated.shippingAddressLine1,
        addressLine2: updated.shippingAddressLine2,
        ward: updated.shippingWard,
        district: updated.shippingDistrict,
        province: updated.shippingProvince,
        regionCode: updated.shippingRegionCode
      },
      note: updated.note
    };
  }

  async cancel(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (![OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING].includes(order.status as OrderStatus)) {
      throw new ConflictException("Orders can only be cancelled before shipping starts");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED
        }
      });

      await this.orderStatusHistoryService.record(
        {
          orderId: order.id,
          status: OrderStatus.CANCELLED,
          actorType: "CUSTOMER",
          actorUserId: userId,
          note: "Buyer cancelled the order before shipping"
        },
        tx
      );

      return nextOrder;
    });

    await this.notificationsService.create({
      userId: order.shopId ? (await this.prisma.shop.findUnique({ where: { id: order.shopId }, select: { ownerId: true } }))?.ownerId ?? userId : userId,
      category: NotificationCategory.ORDER_STATUS,
      title: "Order cancelled by buyer",
      body: `${order.orderNumber} was cancelled before shipping.`,
      linkUrl: "/seller/orders"
    });

    return {
      id: updated.id,
      status: updated.status
    };
  }

  async complete(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new ConflictException("Only delivered orders can be marked complete");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.COMPLETED
        }
      });

      await this.orderStatusHistoryService.record(
        {
          orderId: order.id,
          status: OrderStatus.COMPLETED,
          actorType: "CUSTOMER",
          actorUserId: userId,
          note: "Buyer confirmed delivery and completed the order"
        },
        tx
      );

      return nextOrder;
    });

    const seller = await this.prisma.shop.findUnique({
      where: { id: order.shopId },
      select: { ownerId: true }
    });

    if (seller) {
      await this.notificationsService.create({
        userId: seller.ownerId,
        category: NotificationCategory.ORDER_STATUS,
        title: "Order marked completed",
        body: `${order.orderNumber} has been completed by the buyer.`,
        linkUrl: "/seller/orders"
      });
    }

    const buyer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        fullName: true
      }
    });

    if (buyer) {
      const publicSettings = await this.systemSettingsService.getPublicSummary();
      await this.mailerService.sendSafely({
        to: buyer.email,
        subject: `${publicSettings.marketplaceName}: order completed ${order.orderNumber}`,
        html: `<p>Hello ${buyer.fullName},</p><p>Your order ${order.orderNumber} on ${publicSettings.marketplaceName} has been marked completed.</p><p>You can now leave a review for the purchased items.</p><p>Support: ${publicSettings.supportEmail}</p>`,
        text: `Hello ${buyer.fullName}, your order ${order.orderNumber} on ${publicSettings.marketplaceName} has been marked completed. You can now leave a review for the purchased items. Support: ${publicSettings.supportEmail}.`,
        tags: ["order_completed"]
      });
    }

    return {
      id: updated.id,
      status: updated.status
    };
  }

  async requestReturn(
    userId: string,
    orderId: string,
    payload: {
      reason: string;
      details?: string;
    }
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (![OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(order.status as OrderStatus)) {
      throw new ConflictException("Return requests are only allowed after delivery");
    }

    const statusTimeline = await this.orderStatusHistoryService.listForOrder(order.id);
    const returnRequestWindowDays = await this.systemSettingsService.getNumberValue(
      "return_request_window_days"
    );
    const returnWindow = this.buildReturnWindow(
      order.status as OrderStatus,
      order.updatedAt,
      statusTimeline,
      returnRequestWindowDays
    );
    if (!returnWindow.canRequest) {
      throw new ConflictException("Return window has expired");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.RETURN_REQUESTED
        }
      });

      await this.orderStatusHistoryService.record(
        {
          orderId: order.id,
          status: OrderStatus.RETURN_REQUESTED,
          actorType: "CUSTOMER",
          actorUserId: userId,
          note: payload.reason,
          metadata: payload.details
            ? {
                details: payload.details
              }
            : undefined
        },
        tx
      );

      return nextOrder;
    });

    const seller = await this.prisma.shop.findUnique({
      where: { id: order.shopId },
      select: { ownerId: true }
    });

    if (seller) {
      await this.notificationsService.create({
        userId: seller.ownerId,
        category: NotificationCategory.ORDER_STATUS,
        title: "Buyer requested a return",
        body: `${order.orderNumber} has a new return request.`,
        linkUrl: "/seller/orders"
      });
    }

    return {
      id: updated.id,
      status: updated.status
    };
  }

  async listSellerOrders(userId: string) {
    await this.paymentLifecycleService.expireStalePendingPayments({
      shopOwnerId: userId
    });

    const orders = await this.prisma.order.findMany({
      where: {
        shop: {
          ownerId: userId
        }
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        },
        items: {
          select: {
            id: true,
            productName: true,
            productSlug: true,
            variantName: true,
            quantity: true,
            subtotal: true
          },
          orderBy: [{ createdAt: "asc" }]
        },
        payments: {
          select: {
            id: true,
            method: true,
            status: true,
            amount: true,
            referenceCode: true,
            expiresAt: true,
            paidAt: true
          },
          orderBy: [{ createdAt: "desc" }]
        }
      }
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      itemsSubtotal: order.itemsSubtotal.toString(),
      shippingFee: order.shippingFee.toString(),
      discountTotal: order.discountTotal.toString(),
      grandTotal: order.grandTotal.toString(),
      appliedVoucherCodes: order.appliedVoucherCodes,
      placedAt: order.placedAt.toISOString(),
      customer: order.user,
      shop: order.shop,
      items: order.items.map((item) => ({
        ...item,
        subtotal: item.subtotal.toString()
      })),
      payments: order.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toString(),
        expiresAt: payment.expiresAt?.toISOString() ?? null,
        paidAt: payment.paidAt?.toISOString() ?? null
      }))
    }));
  }

  async getSellerOrderDetail(userId: string, orderId: string) {
    await this.paymentLifecycleService.expireStalePendingPayments({
      orderIds: [orderId],
      shopOwnerId: userId
    });

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        shop: {
          ownerId: userId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true
          }
        },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        },
        items: {
          orderBy: [{ createdAt: "asc" }]
        },
        payments: {
          orderBy: [{ createdAt: "desc" }],
          include: {
            events: {
              include: {
                actorUser: {
                  select: {
                    id: true,
                    fullName: true,
                    role: true
                  }
                }
              },
              orderBy: [{ createdAt: "asc" }]
            }
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const statusTimeline = await this.orderStatusHistoryService.listForOrder(order.id);
    const [autoCompleteDays, returnRequestWindowDays] = await Promise.all([
      this.systemSettingsService.getNumberValue("order_auto_complete_days"),
      this.systemSettingsService.getNumberValue("return_request_window_days")
    ]);
    return {
      ...this.serializeOrderDetail(order),
      customer: order.user,
      shop: order.shop,
      statusTimeline,
      latestShippingUpdate: this.extractLatestShippingUpdate(statusTimeline),
      returnWindow: this.buildReturnWindow(
        order.status as OrderStatus,
        order.updatedAt,
        statusTimeline,
        returnRequestWindowDays
      ),
      shippingUpdateWindow: {
        canEdit: this.canCustomerEditShipping(order.status as OrderStatus, statusTimeline),
        lockedReason: null
      },
      autoCompleteWindow: this.buildAutoCompleteWindow(
        order.status as OrderStatus,
        order.updatedAt,
        statusTimeline,
        autoCompleteDays
      )
    };
  }

  async updateSellerStatus(userId: string, orderId: string, nextStatus: OrderStatus) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        shop: {
          ownerId: userId
        }
      },
      include: {
        payments: {
          orderBy: [{ createdAt: "desc" }]
        }
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    this.assertSellerTransitionAllowed(order.status as OrderStatus, nextStatus);
    if (nextStatus === OrderStatus.CONFIRMED) {
      this.assertOrderReadyForConfirmation(order.paymentMethod as PaymentMethod, order.payments);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus
        }
      });

      await this.orderStatusHistoryService.record(
        {
          orderId: order.id,
          status: nextStatus,
          actorType: "SELLER",
          actorUserId: userId,
          note: this.getSellerTransitionNote(nextStatus)
        },
        tx
      );

      return nextOrder;
    });

    await this.notificationsService.create({
      userId: order.userId,
      category: NotificationCategory.ORDER_STATUS,
      title: "Order status updated",
      body: `${order.orderNumber} is now ${nextStatus.replaceAll("_", " ").toLowerCase()}.`,
      linkUrl: `/orders/${order.id}`
    });

    return {
      id: updated.id,
      status: updated.status
    };
  }

  async updateAdminStatus(actor: AuthPayload, orderId: string, nextStatus: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const allowedStatuses = new Set<OrderStatus>([
      OrderStatus.CANCELLED,
      OrderStatus.DELIVERY_FAILED,
      OrderStatus.REFUNDED,
      OrderStatus.COMPLETED
    ]);

    if (!allowedStatuses.has(nextStatus)) {
      throw new ConflictException("Admin can only set terminal moderation statuses");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: nextStatus
        }
      });

      await this.orderStatusHistoryService.record(
        {
          orderId,
          status: nextStatus,
          actorType: "ADMIN",
          note: `Admin updated order status to ${nextStatus.replaceAll("_", " ").toLowerCase()}`
        },
        tx
      );

      return nextOrder;
    });

    await this.notificationsService.create({
      userId: order.userId,
      category: NotificationCategory.ORDER_STATUS,
      title: "Admin updated your order",
      body: `${order.orderNumber} is now ${nextStatus.replaceAll("_", " ").toLowerCase()}.`,
      linkUrl: `/orders/${order.id}`
    });

    await this.auditLogsService.record({
      actorUserId: actor.sub,
      actorRole: actor.role,
      action: "orders.admin.update_status",
      entityType: "ORDER",
      entityId: orderId,
      summary: `Updated order ${order.orderNumber} to ${nextStatus}`,
      metadata: {
        previousStatus: order.status,
        nextStatus
      }
    });

    return {
      id: updated.id,
      status: updated.status
    };
  }

  private assertSellerTransitionAllowed(currentStatus: OrderStatus, nextStatus: OrderStatus) {
    const allowedTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPING],
      [OrderStatus.SHIPPING]: [OrderStatus.DELIVERED, OrderStatus.DELIVERY_FAILED],
      [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED]
    };

    const nextStatuses = allowedTransitions[currentStatus] ?? [];
    if (!nextStatuses.includes(nextStatus)) {
      throw new ConflictException(`Seller cannot move order from ${currentStatus} to ${nextStatus}`);
    }
  }

  private assertOrderReadyForConfirmation(
    paymentMethod: PaymentMethod,
    payments: Array<{ status: string }>
  ) {
    if (paymentMethod === PaymentMethod.COD) {
      return;
    }

    const hasPaidPayment = payments.some((payment) => payment.status === PaymentStatus.PAID);
    if (!hasPaidPayment) {
      throw new ConflictException("Order cannot be confirmed before payment is completed");
    }
  }

  private serializeOrderDetail(order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentMethod: string;
    shippingRecipientName: string;
    shippingPhoneNumber: string;
    shippingAddressLine1: string;
    shippingAddressLine2: string | null;
    shippingWard: string | null;
    shippingDistrict: string;
    shippingProvince: string;
    shippingRegionCode: string;
    itemsSubtotal: { toString(): string };
    shippingFee: { toString(): string };
    discountTotal: { toString(): string };
    grandTotal: { toString(): string };
    note: string | null;
    appliedVoucherCodes: string[];
    placedAt: Date;
    shop: { id: string; name: string; slug: string };
    items: Array<{
      id: string;
      productId: string;
      productVariantId: string | null;
      productName: string;
      productSlug: string;
      productSku: string;
      variantName: string | null;
      variantSku: string | null;
      variantAttributes: unknown;
      quantity: number;
      unitPrice: { toString(): string };
      subtotal: { toString(): string };
      review?: { id: string } | null;
    }>;
    payments: Array<{
      id: string;
      method: string;
      status: string;
      amount: { toString(): string };
      referenceCode: string;
      expiresAt: Date | null;
      paidAt: Date | null;
      metadata: unknown;
      events?: Array<{
        id: string;
        eventType: string;
        source: string;
        actorType: string;
        actorUser: {
          id: string;
          fullName: string;
          role: string;
        } | null;
        previousStatus: string | null;
        nextStatus: string;
        payload: unknown;
        createdAt: Date;
      }>;
    }>;
  }) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      shippingAddress: {
        recipientName: order.shippingRecipientName,
        phoneNumber: order.shippingPhoneNumber,
        addressLine1: order.shippingAddressLine1,
        addressLine2: order.shippingAddressLine2,
        ward: order.shippingWard,
        district: order.shippingDistrict,
        province: order.shippingProvince,
        regionCode: order.shippingRegionCode
      },
      totals: {
        itemsSubtotal: order.itemsSubtotal.toString(),
        shippingFee: order.shippingFee.toString(),
        discountTotal: order.discountTotal.toString(),
        grandTotal: order.grandTotal.toString()
      },
      shop: order.shop,
      note: order.note,
      appliedVoucherCodes: order.appliedVoucherCodes,
      placedAt: order.placedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
        productName: item.productName,
        productSlug: item.productSlug,
        productSku: item.productSku,
        variantName: item.variantName,
        variantSku: item.variantSku,
        variantAttributes: item.variantAttributes as Record<string, string> | null,
        quantity: item.quantity,
        reviewId: item.review?.id ?? null,
        unitPrice: item.unitPrice.toString(),
        subtotal: item.subtotal.toString()
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amount: payment.amount.toString(),
        referenceCode: payment.referenceCode,
        expiresAt: payment.expiresAt?.toISOString() ?? null,
        paidAt: payment.paidAt?.toISOString() ?? null,
        metadata: (payment.metadata as Record<string, unknown> | null) ?? null,
        checkoutArtifact: this.paymentGatewayService.parseCheckoutArtifact(payment.metadata),
        events:
          payment.events?.map((event) => ({
            id: event.id,
            eventType: event.eventType,
            source: event.source,
            actorType: event.actorType,
            actorUser: event.actorUser
              ? {
                  id: event.actorUser.id,
                  fullName: event.actorUser.fullName,
                  role: event.actorUser.role
                }
              : null,
            previousStatus: event.previousStatus,
            nextStatus: event.nextStatus,
            payload: (event.payload as Record<string, unknown> | null) ?? null,
            createdAt: event.createdAt.toISOString()
          })) ?? []
      }))
    };
  }

  private buildReturnWindow(
    currentStatus: OrderStatus,
    orderUpdatedAt: Date,
    statusTimeline: Array<{ status: string; createdAt: string }>,
    windowDays: number
  ) {
    const deliveredEntry = [...statusTimeline]
      .reverse()
      .find((entry) => entry.status === OrderStatus.DELIVERED);
    const deliveredAt = deliveredEntry?.createdAt ?? null;
    const deliveredDate =
      deliveredAt
        ? new Date(deliveredAt)
        : [OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(currentStatus)
          ? orderUpdatedAt
          : null;
    const expiresAt = deliveredDate
      ? new Date(deliveredDate.getTime() + windowDays * 24 * 60 * 60 * 1000)
      : null;
    const canRequest =
      Boolean(deliveredDate) &&
      [OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(currentStatus) &&
      Boolean(expiresAt && expiresAt.getTime() >= Date.now());

    return {
      canRequest,
      deliveredAt: deliveredDate?.toISOString() ?? null,
      expiresAt: expiresAt?.toISOString() ?? null
    };
  }

  private buildAutoCompleteWindow(
    currentStatus: OrderStatus,
    orderUpdatedAt: Date,
    statusTimeline: Array<{ status: string; createdAt: string }>,
    windowDays: number
  ) {
    const deliveredEntry = [...statusTimeline]
      .reverse()
      .find((entry) => entry.status === OrderStatus.DELIVERED);
    const deliveredAt = deliveredEntry?.createdAt ?? null;
    const deliveredDate =
      deliveredAt
        ? new Date(deliveredAt)
        : currentStatus === OrderStatus.DELIVERED
          ? orderUpdatedAt
          : null;
    const autoCompleteAt = deliveredDate
      ? new Date(deliveredDate.getTime() + windowDays * 24 * 60 * 60 * 1000)
      : null;

    return {
      canAutoComplete:
        currentStatus === OrderStatus.DELIVERED &&
        Boolean(autoCompleteAt && autoCompleteAt.getTime() > Date.now()),
      deliveredAt: deliveredDate?.toISOString() ?? null,
      autoCompleteAt: autoCompleteAt?.toISOString() ?? null,
      windowDays
    };
  }

  private canCustomerEditShipping(
    currentStatus: OrderStatus,
    statusTimeline: Array<{ status: string; actorType: string }>
  ) {
    if (
      [
        OrderStatus.SHIPPING,
        OrderStatus.DELIVERED,
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED,
        OrderStatus.DELIVERY_FAILED,
        OrderStatus.RETURN_REQUESTED,
        OrderStatus.RETURNED,
        OrderStatus.REFUNDED
      ].includes(currentStatus)
    ) {
      return false;
    }

    const sellerHasHandled = statusTimeline.some(
      (entry) =>
        entry.actorType === "SELLER" &&
        [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPING].includes(
          entry.status as OrderStatus
        )
    );

    return !sellerHasHandled;
  }

  private extractLatestShippingUpdate(
    statusTimeline: Array<{
      status: string;
      actorType: string;
      actorUser: {
        id: string;
        fullName: string;
        role: string;
      } | null;
      note: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
    }>
  ) {
    const latestEntry = [...statusTimeline]
      .reverse()
      .find(
        (entry) =>
          entry.actorType === "CUSTOMER" &&
          this.hasShippingUpdateMetadata(entry.metadata)
      );

    if (!latestEntry || !latestEntry.metadata) {
      return null;
    }

    const metadata = latestEntry.metadata;

    return {
      updatedAt: latestEntry.createdAt,
      actorType: latestEntry.actorType,
      actorUser: latestEntry.actorUser
        ? {
            id: latestEntry.actorUser.id,
            fullName: latestEntry.actorUser.fullName,
            role: latestEntry.actorUser.role
          }
        : null,
      note: latestEntry.note,
      changedFields: this.readChangedFields(metadata.changedFields),
      previousAddress: this.readAddressSnapshot(metadata.previousAddress),
      nextAddress: this.readAddressSnapshot(metadata.nextAddress)
    };
  }

  private hasShippingUpdateMetadata(metadata: Record<string, unknown> | null) {
    if (!metadata) {
      return false;
    }

    return (
      typeof metadata.previousAddress === "object" &&
      metadata.previousAddress !== null &&
      typeof metadata.nextAddress === "object" &&
      metadata.nextAddress !== null
    );
  }

  private readChangedFields(value: unknown): OrderShippingChangeField[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const field = item as Record<string, unknown>;
      if (
        typeof field.key !== "string" ||
        typeof field.label !== "string"
      ) {
        return [];
      }

      return [
        {
          key: field.key as OrderShippingChangeField["key"],
          label: field.label,
          previousValue:
            field.previousValue === null || typeof field.previousValue === "string"
              ? field.previousValue
              : String(field.previousValue ?? ""),
          nextValue:
            field.nextValue === null || typeof field.nextValue === "string"
              ? field.nextValue
              : String(field.nextValue ?? "")
        }
      ];
    });
  }

  private readAddressSnapshot(value: unknown) {
    if (!value || typeof value !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        item === null || typeof item === "string" ? item : String(item ?? "")
      ])
    );
  }

  private buildShippingChangedFields(
    previousAddress: Record<string, string | null>,
    nextAddress: Record<string, string | null>
  ): OrderShippingChangeField[] {
    const fieldLabels: Record<OrderShippingChangeField["key"], string> = {
      recipientName: "Recipient name",
      phoneNumber: "Phone number",
      addressLine1: "Address line 1",
      addressLine2: "Address line 2",
      ward: "Ward",
      district: "District",
      province: "Province",
      regionCode: "Region code",
      note: "Delivery note"
    };

    return (Object.keys(fieldLabels) as OrderShippingChangeField["key"][])
      .filter((key) => (previousAddress[key] ?? null) !== (nextAddress[key] ?? null))
      .map((key) => ({
        key,
        label: fieldLabels[key],
        previousValue: previousAddress[key] ?? null,
        nextValue: nextAddress[key] ?? null
      }));
  }

  private getSellerTransitionNote(nextStatus: OrderStatus) {
    switch (nextStatus) {
      case OrderStatus.CONFIRMED:
        return "Seller confirmed the order";
      case OrderStatus.PROCESSING:
        return "Seller started preparing the package";
      case OrderStatus.SHIPPING:
        return "Seller handed the order to shipping";
      case OrderStatus.DELIVERED:
        return "Seller marked the shipment as delivered";
      case OrderStatus.DELIVERY_FAILED:
        return "Seller marked the delivery as failed";
      case OrderStatus.RETURNED:
        return "Seller marked the returned package as received";
      default:
        return `Seller updated order status to ${nextStatus.replaceAll("_", " ").toLowerCase()}`;
    }
  }
}
