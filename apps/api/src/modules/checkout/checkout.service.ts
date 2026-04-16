import {
  BadRequestException,
  ConflictException,
  Injectable
} from "@nestjs/common";
import {
  type CheckoutPreview,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  ShopStatus
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CheckoutPreviewDto } from "./dto/checkout-preview.dto";

const checkoutCartInclude = {
  product: {
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deletedAt: true
        }
      }
    }
  },
  productVariant: true
} satisfies Prisma.CartItemInclude;

type CheckoutCartItem = Prisma.CartItemGetPayload<{
  include: typeof checkoutCartInclude;
}>;

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(userId: string, payload: CheckoutPreviewDto): Promise<CheckoutPreview> {
    const cartItems = await this.getValidatedCartItems(userId);
    return this.buildPreview(cartItems, payload);
  }

  async placeOrder(userId: string, payload: CheckoutPreviewDto) {
    const cartItems = await this.getValidatedCartItems(userId);
    const preview = this.buildPreview(cartItems, payload);
    const placedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const createdOrders = [];

      for (const shopGroup of preview.shops) {
        const groupItems = cartItems.filter((item) => item.product.shopId === shopGroup.shop.id);
        const orderNumber = this.generateOrderNumber(shopGroup.shop.id);
        const order = await tx.order.create({
          data: {
            userId,
            shopId: shopGroup.shop.id,
            orderNumber,
            status:
              payload.paymentMethod === PaymentMethod.COD
                ? OrderStatus.CONFIRMED
                : OrderStatus.PENDING,
            paymentMethod: payload.paymentMethod,
            shippingRecipientName: payload.shippingAddress.recipientName,
            shippingPhoneNumber: payload.shippingAddress.phoneNumber,
            shippingAddressLine1: payload.shippingAddress.addressLine1,
            shippingAddressLine2: payload.shippingAddress.addressLine2,
            shippingWard: payload.shippingAddress.ward,
            shippingDistrict: payload.shippingAddress.district,
            shippingProvince: payload.shippingAddress.province,
            shippingRegionCode: payload.shippingAddress.regionCode,
            itemsSubtotal: new Prisma.Decimal(shopGroup.itemsSubtotal),
            shippingFee: new Prisma.Decimal(shopGroup.shippingFee),
            discountTotal: new Prisma.Decimal(shopGroup.discountTotal),
            grandTotal: new Prisma.Decimal(shopGroup.grandTotal),
            note: payload.note,
            placedAt,
            items: {
              create: groupItems.map((item) => {
                const unitPrice = item.productVariant?.price ?? item.product.salePrice;
                return {
                  productId: item.productId,
                  productVariantId: item.productVariantId,
                  quantity: item.quantity,
                  productName: item.product.name,
                  productSlug: item.product.slug,
                  productSku: item.product.sku,
                  variantName: item.productVariant?.name,
                  variantSku: item.productVariant?.sku,
                  variantAttributes: item.productVariant?.attributes ?? undefined,
                  unitPrice,
                  subtotal: unitPrice.mul(item.quantity)
                };
              })
            }
          }
        });

        const paymentStatus =
          payload.paymentMethod === PaymentMethod.COD
            ? PaymentStatus.PAID
            : PaymentStatus.PENDING;

        await tx.payment.create({
          data: {
            orderId: order.id,
            userId,
            method: payload.paymentMethod,
            status: paymentStatus,
            amount: new Prisma.Decimal(shopGroup.grandTotal),
            referenceCode: this.generatePaymentReference(order.id),
            expiresAt:
              payload.paymentMethod === PaymentMethod.COD
                ? null
                : new Date(placedAt.getTime() + 15 * 60 * 1000),
            paidAt: payload.paymentMethod === PaymentMethod.COD ? placedAt : null,
            metadata:
              payload.paymentMethod === PaymentMethod.COD
                ? { flow: "cash_on_delivery" }
                : { flow: "mock_pending_payment" }
          }
        });

        for (const item of groupItems) {
          if (item.productVariantId) {
            await tx.productVariant.update({
              where: { id: item.productVariantId },
              data: {
                stock: {
                  decrement: item.quantity
                }
              }
            });
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.quantity
              }
            }
          });
        }

        createdOrders.push(order);
      }

      await tx.cartItem.deleteMany({
        where: {
          userId
        }
      });

      return createdOrders;
    });

    return {
      orders: result.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        shopId: order.shopId,
        status: order.status,
        paymentMethod: order.paymentMethod,
        itemsSubtotal: order.itemsSubtotal.toString(),
        shippingFee: order.shippingFee.toString(),
        discountTotal: order.discountTotal.toString(),
        grandTotal: order.grandTotal.toString(),
        placedAt: order.placedAt.toISOString()
      })),
      checkoutPreview: preview
    };
  }

  private async getValidatedCartItems(userId: string): Promise<CheckoutCartItem[]> {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: checkoutCartInclude,
      orderBy: [{ updatedAt: "desc" }]
    });

    if (cartItems.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    for (const item of cartItems) {
      if (
        item.product.deletedAt ||
        item.product.status !== ProductStatus.ACTIVE ||
        item.product.shop.deletedAt ||
        item.product.shop.status !== ShopStatus.ACTIVE
      ) {
        throw new ConflictException("Cart contains unavailable products");
      }

      const availableStock = item.productVariant?.stock ?? item.product.stock;
      if (availableStock < item.quantity) {
        throw new ConflictException("Cart quantity exceeds current stock");
      }
    }

    return cartItems;
  }

  private buildPreview(
    cartItems: CheckoutCartItem[],
    payload: CheckoutPreviewDto
  ): CheckoutPreview {
    const groupMap = new Map<
      string,
      {
        shop: { id: string; name: string; slug: string };
        itemsSubtotal: Prisma.Decimal;
        shippingFee: Prisma.Decimal;
        discountTotal: Prisma.Decimal;
        grandTotal: Prisma.Decimal;
        totalWeightGrams: number;
      }
    >();

    let itemCount = 0;
    let itemsSubtotal = new Prisma.Decimal(0);
    let shippingFeeTotal = new Prisma.Decimal(0);

    for (const item of cartItems) {
      const unitPrice = item.productVariant?.price ?? item.product.salePrice;
      const lineSubtotal = unitPrice.mul(item.quantity);
      const lineWeight = (item.product.weightGrams ?? 300) * item.quantity;
      itemCount += item.quantity;
      itemsSubtotal = itemsSubtotal.add(lineSubtotal);

      const existing =
        groupMap.get(item.product.shop.id) ??
        {
          shop: {
            id: item.product.shop.id,
            name: item.product.shop.name,
            slug: item.product.shop.slug
          },
          itemsSubtotal: new Prisma.Decimal(0),
          shippingFee: new Prisma.Decimal(0),
          discountTotal: new Prisma.Decimal(0),
          grandTotal: new Prisma.Decimal(0),
          totalWeightGrams: 0
        };

      existing.itemsSubtotal = existing.itemsSubtotal.add(lineSubtotal);
      existing.totalWeightGrams += lineWeight;
      groupMap.set(item.product.shop.id, existing);
    }

    const shops = Array.from(groupMap.values()).map((group) => {
      const shippingFee = this.calculateShippingFee(
        payload.shippingAddress.regionCode,
        group.totalWeightGrams
      );
      const grandTotal = group.itemsSubtotal.add(shippingFee).sub(group.discountTotal);
      shippingFeeTotal = shippingFeeTotal.add(shippingFee);

      return {
        shop: group.shop,
        itemsSubtotal: group.itemsSubtotal.toString(),
        shippingFee: shippingFee.toString(),
        discountTotal: group.discountTotal.toString(),
        grandTotal: grandTotal.toString()
      };
    });

    return {
      paymentMethod: payload.paymentMethod,
      shippingAddress: {
        recipientName: payload.shippingAddress.recipientName,
        phoneNumber: payload.shippingAddress.phoneNumber,
        addressLine1: payload.shippingAddress.addressLine1,
        addressLine2: payload.shippingAddress.addressLine2 ?? null,
        ward: payload.shippingAddress.ward ?? null,
        district: payload.shippingAddress.district,
        province: payload.shippingAddress.province,
        regionCode: payload.shippingAddress.regionCode
      },
      shops,
      totals: {
        itemCount,
        itemsSubtotal: itemsSubtotal.toString(),
        shippingFee: shippingFeeTotal.toString(),
        discountTotal: "0",
        grandTotal: itemsSubtotal.add(shippingFeeTotal).toString()
      }
    };
  }

  private calculateShippingFee(regionCode: string, totalWeightGrams: number) {
    const baseFees: Record<string, number> = {
      HN: 18000,
      HCM: 18000,
      CENTRAL: 28000,
      OTHER: 35000
    };
    const baseFee = baseFees[regionCode] ?? 35000;
    const extraBlocks = Math.max(0, Math.ceil((totalWeightGrams - 500) / 500));
    return new Prisma.Decimal(baseFee + extraBlocks * 6000);
  }

  private generateOrderNumber(shopId: string) {
    return `ORD-${shopId.slice(-4).toUpperCase()}-${Date.now()}`;
  }

  private generatePaymentReference(orderId: string) {
    return `PAY-${orderId.slice(-6).toUpperCase()}-${Date.now()}`;
  }
}
