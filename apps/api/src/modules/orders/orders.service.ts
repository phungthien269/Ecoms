import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  NotificationCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { MailerService } from "../mailer/mailer.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OrderStatusHistoryService } from "../orderStatusHistory/order-status-history.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "../auditLogs/audit-logs.service";
import type { AuthPayload } from "../auth/types/auth-payload";
import { ListAdminOrdersDto } from "./dto/list-admin-orders.dto";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly mailerService: MailerService,
    private readonly orderStatusHistoryService: OrderStatusHistoryService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async listOwn(userId: string) {
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
          orderBy: [{ createdAt: "desc" }]
        }
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const statusTimeline = await this.orderStatusHistoryService.listForOrder(order.id);
    return {
      ...this.serializeOrderDetail(order),
      statusTimeline,
      returnWindow: this.buildReturnWindow(order.status as OrderStatus, order.updatedAt, statusTimeline)
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
      await this.mailerService.sendSafely({
        to: buyer.email,
        subject: `Order completed: ${order.orderNumber}`,
        html: `<p>Hello ${buyer.fullName},</p><p>Your order ${order.orderNumber} has been marked completed.</p><p>You can now leave a review for the purchased items.</p>`,
        text: `Hello ${buyer.fullName}, your order ${order.orderNumber} has been marked completed. You can now leave a review for the purchased items.`,
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
    const returnWindow = this.buildReturnWindow(order.status as OrderStatus, order.updatedAt, statusTimeline);
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
          orderBy: [{ createdAt: "desc" }]
        }
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const statusTimeline = await this.orderStatusHistoryService.listForOrder(order.id);
    return {
      ...this.serializeOrderDetail(order),
      customer: order.user,
      shop: order.shop,
      statusTimeline,
      returnWindow: this.buildReturnWindow(order.status as OrderStatus, order.updatedAt, statusTimeline)
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
        metadata: (payment.metadata as Record<string, unknown> | null) ?? null
      }))
    };
  }

  private buildReturnWindow(
    currentStatus: OrderStatus,
    orderUpdatedAt: Date,
    statusTimeline: Array<{ status: string; createdAt: string }>
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
    const expiresAt = deliveredDate ? new Date(deliveredDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
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
