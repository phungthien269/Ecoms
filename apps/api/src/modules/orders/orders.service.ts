import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  NotificationCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus
} from "@ecoms/contracts";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
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

  async listAdmin() {
    const orders = await this.prisma.order.findMany({
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
      },
      take: 50
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
      placedAt: order.placedAt.toISOString(),
      customer: order.user,
      shop: order.shop,
      payments: order.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toString(),
        expiresAt: payment.expiresAt?.toISOString() ?? null
      }))
    }));
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
        variantAttributes: item.variantAttributes,
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
        metadata: payment.metadata
      }))
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

    if ([OrderStatus.SHIPPING, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(order.status as OrderStatus)) {
      throw new ConflictException("Orders can only be cancelled before shipping starts");
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED
      }
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

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.COMPLETED
      }
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
      customer: order.user,
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
        variantAttributes: item.variantAttributes,
        quantity: item.quantity,
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
        metadata: payment.metadata
      }))
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

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus
      }
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

  async updateAdminStatus(orderId: string, nextStatus: OrderStatus) {
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

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: nextStatus
      }
    });

    await this.notificationsService.create({
      userId: order.userId,
      category: NotificationCategory.ORDER_STATUS,
      title: "Admin updated your order",
      body: `${order.orderNumber} is now ${nextStatus.replaceAll("_", " ").toLowerCase()}.`,
      linkUrl: `/orders/${order.id}`
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
      [OrderStatus.SHIPPING]: [OrderStatus.DELIVERED, OrderStatus.DELIVERY_FAILED]
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
}
