import {
  BadRequestException,
  ConflictException,
  Injectable
} from "@nestjs/common";
import {
  NotificationCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  ShopStatus,
  VoucherDiscountType,
  VoucherScope,
  type AppliedVoucherSummary,
  type CheckoutPreview,
  type CheckoutVoucherSelection
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { MailerService } from "../mailer/mailer.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OrderStatusHistoryService } from "../orderStatusHistory/order-status-history.service";
import { PrismaService } from "../prisma/prisma.service";
import { SystemSettingsService } from "../systemSettings/system-settings.service";
import { VouchersService } from "../vouchers/vouchers.service";
import { CheckoutPreviewDto } from "./dto/checkout-preview.dto";

const checkoutCartInclude = {
  product: {
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          slug: true,
          ownerId: true,
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

type PreviewShopSummary = CheckoutPreview["shops"][number];

type VoucherAllocation = {
  voucherId: string;
  code: string;
  name: string;
  scope: VoucherScope;
  discountAmount: Prisma.Decimal;
  shopDiscounts: Map<string, Prisma.Decimal>;
  orderIds: string[];
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vouchersService: VouchersService,
    private readonly notificationsService: NotificationsService,
    private readonly mailerService: MailerService,
    private readonly orderStatusHistoryService: OrderStatusHistoryService,
    private readonly systemSettingsService: SystemSettingsService
  ) {}

  async preview(userId: string, payload: CheckoutPreviewDto): Promise<CheckoutPreview> {
    const cartItems = await this.getValidatedCartItems(userId);
    return this.buildPreview(userId, cartItems, payload);
  }

  async placeOrder(userId: string, payload: CheckoutPreviewDto) {
    const cartItems = await this.getValidatedCartItems(userId);
    const preview = await this.buildPreview(userId, cartItems, payload);
    const placedAt = new Date();
    const [paymentTimeoutMinutes, publicSettings] = await Promise.all([
      this.systemSettingsService.getNumberValue("payment_timeout_minutes"),
      this.systemSettingsService.getPublicSummary()
    ]);
    const appliedVoucherCodes = preview.appliedVouchers.map((voucher) => voucher.code);

    const result = await this.prisma.$transaction(async (tx) => {
      const createdOrders = [] as Array<{
        id: string;
        orderNumber: string;
        shopId: string;
        status: string;
        paymentMethod: string;
        itemsSubtotal: Prisma.Decimal;
        shippingFee: Prisma.Decimal;
        discountTotal: Prisma.Decimal;
        grandTotal: Prisma.Decimal;
        placedAt: Date;
      }>;

      const voucherAllocations = this.buildVoucherAllocationMap(preview);

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
            appliedVoucherCodes,
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

        await this.orderStatusHistoryService.record(
          {
            orderId: order.id,
            status:
              payload.paymentMethod === PaymentMethod.COD
                ? OrderStatus.CONFIRMED
                : OrderStatus.PENDING,
            actorType: "CHECKOUT",
            actorUserId: userId,
            note:
              payload.paymentMethod === PaymentMethod.COD
                ? "Order placed with cash on delivery"
                : "Order placed and waiting for payment confirmation",
            metadata: {
              paymentMethod: payload.paymentMethod
            }
          },
          tx
        );

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
                : new Date(placedAt.getTime() + paymentTimeoutMinutes * 60 * 1000),
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

        for (const allocation of voucherAllocations.values()) {
          const discountForShop = allocation.shopDiscounts.get(shopGroup.shop.id);
          if (discountForShop && discountForShop.gt(0)) {
            allocation.orderIds.push(order.id);
          }
        }

        createdOrders.push(order);
      }

      for (const allocation of voucherAllocations.values()) {
        await tx.voucher.update({
          where: { id: allocation.voucherId },
          data: {
            usedCount: {
              increment: 1
            }
          }
        });

        await tx.voucherRedemption.create({
          data: {
            voucherId: allocation.voucherId,
            userId,
            checkoutReference: `${createdOrders[0]?.id ?? "checkout"}:${allocation.code}`,
            orderIds: allocation.orderIds,
            discountAmount: allocation.discountAmount
          }
        });
      }

      await tx.cartItem.deleteMany({
        where: {
          userId
        }
      });

      return createdOrders;
    });

    await this.notificationsService.create({
      userId,
      category: NotificationCategory.ORDER_STATUS,
      title: "Order placed successfully",
      body: `Created ${result.length} order(s) from your cart.`,
      linkUrl: result[0] ? `/orders/${result[0].id}` : "/orders"
    });

    const sellerNotifications = new Map<string, { shopName: string; orderId: string }>();
    for (const order of result) {
      const shopOwnerId = cartItems.find((item) => item.product.shopId === order.shopId)?.product.shop.ownerId;
      const shopName = cartItems.find((item) => item.product.shopId === order.shopId)?.product.shop.name;
      if (shopOwnerId && shopName) {
        sellerNotifications.set(shopOwnerId, {
          shopName,
          orderId: order.id
        });
      }
    }

    await Promise.all(
      Array.from(sellerNotifications.entries()).map(([sellerUserId, data]) =>
        this.notificationsService.create({
          userId: sellerUserId,
          category: NotificationCategory.ORDER_STATUS,
          title: `New order for ${data.shopName}`,
          body: "A buyer has placed a new order and it is ready for review.",
          linkUrl: `/seller/orders`
        })
      )
    );

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
        subject: `${publicSettings.marketplaceName}: ${result.length} order(s) placed`,
        html: `<p>Hello ${buyer.fullName},</p><p>Your checkout on ${publicSettings.marketplaceName} was successful.</p><p>Orders: ${result
          .map((order) => order.orderNumber)
          .join(", ")}</p><p>Total: ${preview.totals.grandTotal} VND</p><p>Pending online payments expire after ${publicSettings.paymentTimeoutMinutes} minutes.</p><p>Support: ${publicSettings.supportEmail}</p>`,
        text: `Hello ${buyer.fullName}, your checkout on ${publicSettings.marketplaceName} was successful. Orders: ${result
          .map((order) => order.orderNumber)
          .join(", ")}. Total: ${preview.totals.grandTotal} VND. Pending online payments expire after ${publicSettings.paymentTimeoutMinutes} minutes. Support: ${publicSettings.supportEmail}.`,
        tags: ["order_placed"]
      });
    }

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

  private async buildPreview(
    userId: string,
    cartItems: CheckoutCartItem[],
    payload: CheckoutPreviewDto
  ): Promise<CheckoutPreview> {
    const groupMap = new Map<
      string,
      {
        shop: { id: string; name: string; slug: string };
        itemsSubtotal: Prisma.Decimal;
        shippingFee: Prisma.Decimal;
        discountTotal: Prisma.Decimal;
        totalWeightGrams: number;
        eligibleCategorySubtotal: Map<string, Prisma.Decimal>;
        appliedVouchers: AppliedVoucherSummary[];
      }
    >();

    let itemCount = 0;
    let itemsSubtotal = new Prisma.Decimal(0);
    let shippingFeeTotal = new Prisma.Decimal(0);

    const shippingConfig = await this.getShippingFeeConfig();

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
          totalWeightGrams: 0,
          eligibleCategorySubtotal: new Map<string, Prisma.Decimal>(),
          appliedVouchers: []
        };

      existing.itemsSubtotal = existing.itemsSubtotal.add(lineSubtotal);
      existing.totalWeightGrams += lineWeight;

      const categorySubtotal =
        existing.eligibleCategorySubtotal.get(item.product.categoryId) ??
        new Prisma.Decimal(0);
      existing.eligibleCategorySubtotal.set(
        item.product.categoryId,
        categorySubtotal.add(lineSubtotal)
      );

      groupMap.set(item.product.shop.id, existing);
    }

    const shopEntries = Array.from(groupMap.values()).map((group) => {
      const shippingFee = this.calculateShippingFee(
        payload.shippingAddress.regionCode,
        group.totalWeightGrams,
        shippingConfig
      );
      group.shippingFee = shippingFee;
      shippingFeeTotal = shippingFeeTotal.add(shippingFee);
      return group;
    });

    const voucherSelection = this.normalizeVoucherSelection(payload.vouchers);
    const appliedVouchers: AppliedVoucherSummary[] = [];

    await this.applyPlatformVoucher(userId, voucherSelection.platformCode, shopEntries, appliedVouchers);
    await this.applyShopVouchers(userId, voucherSelection.shopCodes ?? [], shopEntries, appliedVouchers);
    await this.applyFreeshipVoucher(userId, voucherSelection.freeshipCode, shopEntries, appliedVouchers);

    const shops: PreviewShopSummary[] = shopEntries.map((group) => {
      const grandTotal = group.itemsSubtotal.add(group.shippingFee).sub(group.discountTotal);
      return {
        shop: group.shop,
        itemsSubtotal: group.itemsSubtotal.toString(),
        shippingFee: group.shippingFee.toString(),
        discountTotal: group.discountTotal.toString(),
        grandTotal: grandTotal.toString(),
        appliedVouchers: group.appliedVouchers
      };
    });

    const discountTotal = shopEntries.reduce(
      (sum, group) => sum.add(group.discountTotal),
      new Prisma.Decimal(0)
    );

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
      vouchers: voucherSelection,
      shops,
      appliedVouchers,
      totals: {
        itemCount,
        itemsSubtotal: itemsSubtotal.toString(),
        shippingFee: shopEntries
          .reduce((sum, group) => sum.add(group.shippingFee), new Prisma.Decimal(0))
          .toString(),
        discountTotal: discountTotal.toString(),
        grandTotal: itemsSubtotal
          .add(shopEntries.reduce((sum, group) => sum.add(group.shippingFee), new Prisma.Decimal(0)))
          .sub(discountTotal)
          .toString()
      }
    };
  }

  private normalizeVoucherSelection(
    vouchers?: CheckoutPreviewDto["vouchers"]
  ): CheckoutVoucherSelection {
    return {
      platformCode: vouchers?.platformCode?.trim() || null,
      freeshipCode: vouchers?.freeshipCode?.trim() || null,
      shopCodes:
        vouchers?.shopCodes
          ?.filter((voucher) => voucher.shopId.trim() && voucher.code.trim())
          .map((voucher) => ({
            shopId: voucher.shopId.trim(),
            code: voucher.code.trim()
          })) ?? []
    };
  }

  private async applyPlatformVoucher(
    userId: string,
    code: string | null | undefined,
    groups: Array<{
      shop: { id: string; name: string; slug: string };
      itemsSubtotal: Prisma.Decimal;
      shippingFee: Prisma.Decimal;
      discountTotal: Prisma.Decimal;
      totalWeightGrams: number;
      eligibleCategorySubtotal: Map<string, Prisma.Decimal>;
      appliedVouchers: AppliedVoucherSummary[];
    }>,
    appliedVouchers: AppliedVoucherSummary[]
  ) {
    if (!code) {
      return;
    }

    const voucher = await this.vouchersService.findActiveVoucherByCode(code);
    if (voucher.scope !== VoucherScope.PLATFORM) {
      throw new ConflictException("Platform voucher code is invalid for this slot");
    }

    await this.vouchersService.assertVoucherUsageAllowed(
      voucher.id,
      userId,
      voucher.perUserUsageLimit
    );

    const eligibleSubtotal = groups.reduce((sum, group) => {
      return sum.add(this.getEligibleMerchandiseSubtotal(group, voucher.categoryId ?? undefined));
    }, new Prisma.Decimal(0));

    this.assertVoucherMinimumReached(voucher.minOrderValue, eligibleSubtotal);
    const discountAmount = this.calculateVoucherDiscount(voucher, eligibleSubtotal);
    if (discountAmount.lte(0)) {
      return;
    }

    const distribution = this.distributeAmountAcrossGroups(
      discountAmount,
      groups.map((group) => ({
        shopId: group.shop.id,
        weight: this.getEligibleMerchandiseSubtotal(group, voucher.categoryId ?? undefined)
      }))
    );

    for (const group of groups) {
      const amount = distribution.get(group.shop.id) ?? new Prisma.Decimal(0);
      if (amount.gt(0)) {
        group.discountTotal = group.discountTotal.add(amount);
        group.appliedVouchers.push(this.serializeAppliedVoucher(voucher, amount));
      }
    }

    appliedVouchers.push(this.serializeAppliedVoucher(voucher, discountAmount));
  }

  private async applyShopVouchers(
    userId: string,
    shopCodes: Array<{ shopId: string; code: string }>,
    groups: Array<{
      shop: { id: string; name: string; slug: string };
      itemsSubtotal: Prisma.Decimal;
      shippingFee: Prisma.Decimal;
      discountTotal: Prisma.Decimal;
      totalWeightGrams: number;
      eligibleCategorySubtotal: Map<string, Prisma.Decimal>;
      appliedVouchers: AppliedVoucherSummary[];
    }>,
    appliedVouchers: AppliedVoucherSummary[]
  ) {
    const seenShopIds = new Set<string>();

    for (const selection of shopCodes) {
      if (seenShopIds.has(selection.shopId)) {
        throw new BadRequestException("Only one shop voucher is allowed per shop");
      }
      seenShopIds.add(selection.shopId);

      const group = groups.find((entry) => entry.shop.id === selection.shopId);
      if (!group) {
        throw new BadRequestException("Shop voucher references a shop not present in cart");
      }

      const voucher = await this.vouchersService.findActiveVoucherByCode(selection.code);
      if (voucher.scope !== VoucherScope.SHOP || voucher.shopId !== selection.shopId) {
        throw new ConflictException("Shop voucher does not belong to this shop");
      }

      await this.vouchersService.assertVoucherUsageAllowed(
        voucher.id,
        userId,
        voucher.perUserUsageLimit
      );

      const eligibleSubtotal = this.getEligibleMerchandiseSubtotal(
        group,
        voucher.categoryId ?? undefined
      );
      this.assertVoucherMinimumReached(voucher.minOrderValue, eligibleSubtotal);
      const discountAmount = this.calculateVoucherDiscount(voucher, eligibleSubtotal);
      if (discountAmount.lte(0)) {
        continue;
      }

      group.discountTotal = group.discountTotal.add(discountAmount);
      const summary = this.serializeAppliedVoucher(voucher, discountAmount);
      group.appliedVouchers.push(summary);
      appliedVouchers.push(summary);
    }
  }

  private async applyFreeshipVoucher(
    userId: string,
    code: string | null | undefined,
    groups: Array<{
      shop: { id: string; name: string; slug: string };
      itemsSubtotal: Prisma.Decimal;
      shippingFee: Prisma.Decimal;
      discountTotal: Prisma.Decimal;
      totalWeightGrams: number;
      eligibleCategorySubtotal: Map<string, Prisma.Decimal>;
      appliedVouchers: AppliedVoucherSummary[];
    }>,
    appliedVouchers: AppliedVoucherSummary[]
  ) {
    if (!code) {
      return;
    }

    const voucher = await this.vouchersService.findActiveVoucherByCode(code);
    if (voucher.scope !== VoucherScope.FREESHIP) {
      throw new ConflictException("Freeship voucher code is invalid for this slot");
    }

    await this.vouchersService.assertVoucherUsageAllowed(
      voucher.id,
      userId,
      voucher.perUserUsageLimit
    );

    const eligibleShippingSubtotal = groups.reduce((sum, group) => {
      return sum.add(group.shippingFee);
    }, new Prisma.Decimal(0));
    const merchandiseSubtotal = groups.reduce((sum, group) => {
      return sum.add(group.itemsSubtotal);
    }, new Prisma.Decimal(0));

    this.assertVoucherMinimumReached(voucher.minOrderValue, merchandiseSubtotal);
    const discountAmount = this.calculateVoucherDiscount(voucher, eligibleShippingSubtotal);
    if (discountAmount.lte(0)) {
      return;
    }

    const distribution = this.distributeAmountAcrossGroups(
      discountAmount,
      groups.map((group) => ({
        shopId: group.shop.id,
        weight: group.shippingFee
      }))
    );

    for (const group of groups) {
      const amount = distribution.get(group.shop.id) ?? new Prisma.Decimal(0);
      if (amount.gt(0)) {
        group.shippingFee = group.shippingFee.sub(amount);
        group.discountTotal = group.discountTotal.add(amount);
        group.appliedVouchers.push(this.serializeAppliedVoucher(voucher, amount));
      }
    }

    appliedVouchers.push(this.serializeAppliedVoucher(voucher, discountAmount));
  }

  private getEligibleMerchandiseSubtotal(
    group: {
      itemsSubtotal: Prisma.Decimal;
      eligibleCategorySubtotal: Map<string, Prisma.Decimal>;
    },
    categoryId?: string
  ) {
    if (!categoryId) {
      return group.itemsSubtotal;
    }

    return group.eligibleCategorySubtotal.get(categoryId) ?? new Prisma.Decimal(0);
  }

  private calculateVoucherDiscount(
    voucher: {
      discountType: string;
      discountValue: Prisma.Decimal;
      maxDiscountAmount: Prisma.Decimal | null;
    },
    eligibleSubtotal: Prisma.Decimal
  ) {
    if (eligibleSubtotal.lte(0)) {
      throw new ConflictException("Voucher is not applicable to the current cart");
    }

    let discount =
      voucher.discountType === "FIXED"
        ? voucher.discountValue
        : eligibleSubtotal.mul(voucher.discountValue).div(100);

    if (voucher.maxDiscountAmount && discount.gt(voucher.maxDiscountAmount)) {
      discount = voucher.maxDiscountAmount;
    }

    if (discount.gt(eligibleSubtotal)) {
      discount = eligibleSubtotal;
    }

    return this.roundCurrency(discount);
  }

  private assertVoucherMinimumReached(
    minimumValue: Prisma.Decimal | null,
    eligibleSubtotal: Prisma.Decimal
  ) {
    if (minimumValue && eligibleSubtotal.lt(minimumValue)) {
      throw new ConflictException("Voucher minimum order value has not been reached");
    }
  }

  private distributeAmountAcrossGroups(
    totalAmount: Prisma.Decimal,
    groups: Array<{ shopId: string; weight: Prisma.Decimal }>
  ) {
    const nonZeroGroups = groups.filter((group) => group.weight.gt(0));
    const totalWeight = nonZeroGroups.reduce(
      (sum, group) => sum.add(group.weight),
      new Prisma.Decimal(0)
    );
    const distribution = new Map<string, Prisma.Decimal>();

    if (nonZeroGroups.length === 0 || totalWeight.lte(0)) {
      return distribution;
    }

    let remaining = totalAmount;
    nonZeroGroups.forEach((group, index) => {
      const amount =
        index === nonZeroGroups.length - 1
          ? remaining
          : this.roundCurrency(totalAmount.mul(group.weight).div(totalWeight));
      distribution.set(group.shopId, amount);
      remaining = remaining.sub(amount);
    });

    return distribution;
  }

  private serializeAppliedVoucher(
    voucher: {
      id: string;
      code: string;
      name: string;
      scope: string;
    },
    discountAmount: Prisma.Decimal
  ): AppliedVoucherSummary {
    return {
      id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      scope: voucher.scope as VoucherScope,
      discountAmount: this.roundCurrency(discountAmount).toString()
    };
  }

  private buildVoucherAllocationMap(preview: CheckoutPreview) {
    const allocations = new Map<string, VoucherAllocation>();

    for (const voucher of preview.appliedVouchers) {
      allocations.set(voucher.id, {
        voucherId: voucher.id,
        code: voucher.code,
        name: voucher.name,
        scope: voucher.scope,
        discountAmount: new Prisma.Decimal(voucher.discountAmount),
        shopDiscounts: new Map<string, Prisma.Decimal>(),
        orderIds: []
      });
    }

    for (const shop of preview.shops) {
      for (const voucher of shop.appliedVouchers) {
        const allocation = allocations.get(voucher.id);
        if (allocation) {
          allocation.shopDiscounts.set(shop.shop.id, new Prisma.Decimal(voucher.discountAmount));
        }
      }
    }

    return allocations;
  }

  private async getShippingFeeConfig() {
    const [
      shippingFeeHn,
      shippingFeeHcm,
      shippingFeeCentral,
      shippingFeeOther,
      shippingFeeExtraPer500g
    ] = await Promise.all([
      this.systemSettingsService.getNumberValue("shipping_fee_hn"),
      this.systemSettingsService.getNumberValue("shipping_fee_hcm"),
      this.systemSettingsService.getNumberValue("shipping_fee_central"),
      this.systemSettingsService.getNumberValue("shipping_fee_other"),
      this.systemSettingsService.getNumberValue("shipping_fee_extra_per_500g")
    ]);

    return {
      HN: shippingFeeHn,
      HCM: shippingFeeHcm,
      CENTRAL: shippingFeeCentral,
      OTHER: shippingFeeOther,
      extraPer500g: shippingFeeExtraPer500g
    };
  }

  private calculateShippingFee(
    regionCode: string,
    totalWeightGrams: number,
    shippingConfig: {
      HN: number;
      HCM: number;
      CENTRAL: number;
      OTHER: number;
      extraPer500g: number;
    }
  ) {
    const baseFee = shippingConfig[regionCode as "HN" | "HCM" | "CENTRAL" | "OTHER"] ?? shippingConfig.OTHER;
    const extraBlocks = Math.max(0, Math.ceil((totalWeightGrams - 500) / 500));
    return new Prisma.Decimal(baseFee + extraBlocks * shippingConfig.extraPer500g);
  }

  private roundCurrency(value: Prisma.Decimal) {
    return new Prisma.Decimal(value.toDecimalPlaces(2).toString());
  }

  private generateOrderNumber(shopId: string) {
    return `ORD-${shopId.slice(-4).toUpperCase()}-${Date.now()}`;
  }

  private generatePaymentReference(orderId: string) {
    return `PAY-${orderId.slice(-6).toUpperCase()}-${Date.now()}`;
  }
}
