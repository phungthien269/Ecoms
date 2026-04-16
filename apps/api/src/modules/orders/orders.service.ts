import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
      placedAt: order.placedAt.toISOString(),
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
      note: order.note,
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
}
