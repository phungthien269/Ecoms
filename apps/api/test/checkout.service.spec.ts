import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  ShopStatus,
  VoucherDiscountType,
  VoucherScope
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { CheckoutService } from "../src/modules/checkout/checkout.service";

function createCartItem() {
  return {
    id: "cart-1",
    userId: "user-1",
    productId: "product-1",
    productVariantId: "variant-1",
    quantity: 2,
    updatedAt: new Date(),
    product: {
      id: "product-1",
      shopId: "shop-1",
      name: "Demo Wireless Gaming Mouse",
      slug: "demo-wireless-gaming-mouse",
      sku: "DEMO-MOUSE-001",
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      stock: 25,
      weightGrams: 400,
      salePrice: new Prisma.Decimal(349000),
      shop: {
        id: "shop-1",
        name: "Demo Seller Shop",
        slug: "demo-seller-shop",
        status: ShopStatus.ACTIVE,
        deletedAt: null
      }
    },
    productVariant: {
      id: "variant-1",
      productId: "product-1",
      sku: "DEMO-MOUSE-001-BLACK",
      name: "Black",
      attributes: { color: "Black" },
      price: new Prisma.Decimal(349000),
      stock: 12
    }
  };
}

describe("CheckoutService", () => {
  const prisma = {
    cartItem: {
      findMany: jest.fn(),
      deleteMany: jest.fn()
    },
    order: {
      create: jest.fn()
    },
    payment: {
      create: jest.fn()
    },
    productVariant: {
      update: jest.fn()
    },
    product: {
      update: jest.fn()
    },
    voucher: {
      update: jest.fn()
    },
    voucherRedemption: {
      create: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  };
  const vouchersService = {
    findActiveVoucherByCode: jest.fn(),
    assertVoucherUsageAllowed: jest.fn()
  };
  const notificationsService = {
    create: jest.fn()
  };
  const mailerService = {
    sendSafely: jest.fn()
  };
  const orderStatusHistoryService = {
    record: jest.fn()
  };
  const paymentEventsService = {
    record: jest.fn()
  };
  const paymentGatewayService = {
    createPendingPaymentMetadata: jest.fn()
  };
  const systemSettingsService = {
    getNumberValue: jest.fn().mockResolvedValue(15),
    getBooleanValue: jest.fn().mockResolvedValue(true),
    getStringValue: jest.fn().mockResolvedValue(""),
    getPublicSummary: jest.fn().mockResolvedValue({
      marketplaceName: "Ecoms Marketplace",
      supportEmail: "support@ecoms.local",
      paymentTimeoutMinutes: 15,
      orderAutoCompleteDays: 3,
      paymentOnlineGatewayEnabled: true,
      paymentIncidentMessage: null
    })
  };

  const service = new CheckoutService(
    prisma as never,
    vouchersService as never,
    notificationsService as never,
    mailerService as never,
    orderStatusHistoryService as never,
    paymentEventsService as never,
    paymentGatewayService as never,
    systemSettingsService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    systemSettingsService.getNumberValue.mockImplementation(async (key: string) => {
      const mapping: Record<string, number> = {
        payment_timeout_minutes: 15,
        default_product_weight_grams: 300,
        shipping_fee_hn: 18000,
        shipping_fee_hcm: 18000,
        shipping_fee_central: 28000,
        shipping_fee_other: 35000,
        shipping_fee_extra_per_500g: 6000
      };

      return mapping[key] ?? 15;
    });
    systemSettingsService.getBooleanValue.mockResolvedValue(true);
    systemSettingsService.getStringValue.mockResolvedValue("");
    paymentGatewayService.createPendingPaymentMetadata.mockImplementation(
      ({
        paymentMethod,
        referenceCode,
        orderId,
        orderNumber,
        amount,
        expiresAt
      }: {
        paymentMethod: PaymentMethod;
        referenceCode: string;
        orderId: string;
        orderNumber: string;
        amount: string;
        expiresAt: Date;
      }) => ({
        flow: "mock_pending_payment",
        provider: "mock_gateway",
        checkoutMode:
          paymentMethod === PaymentMethod.BANK_TRANSFER ? "bank_transfer" : "hosted_checkout",
        paymentUrl: `http://localhost:3000/orders/${orderId}?pay=${referenceCode}`,
        callbackUrl: `http://localhost:3000/orders/${orderId}`,
        sessionToken: `token-${orderNumber}`,
        qrPayload: `BANK|${referenceCode}|${amount}|${orderNumber}`,
        expiresAt: expiresAt.toISOString()
      })
    );
  });

  it("builds a checkout preview split by shop with shipping totals", async () => {
    prisma.cartItem.findMany.mockResolvedValue([createCartItem()]);

    const preview = await service.preview("user-1", {
      paymentMethod: PaymentMethod.COD,
      shippingAddress: {
        recipientName: "Demo Buyer",
        phoneNumber: "0900000000",
        addressLine1: "123 Demo Street",
        district: "District 1",
        province: "Ho Chi Minh City",
        regionCode: "HCM"
      }
    });

    expect(preview.totals).toEqual({
      itemCount: 2,
      itemsSubtotal: "698000",
      shippingFee: "24000",
      discountTotal: "0",
      grandTotal: "722000"
    });
    expect(preview.shops).toHaveLength(1);
    expect(preview.appliedVouchers).toHaveLength(0);
  });

  it("rejects preview when cart is empty", async () => {
    prisma.cartItem.findMany.mockResolvedValue([]);

    await expect(
      service.preview("user-1", {
        paymentMethod: PaymentMethod.COD,
        shippingAddress: {
          recipientName: "Demo Buyer",
          phoneNumber: "0900000000",
          addressLine1: "123 Demo Street",
          district: "District 1",
          province: "Ho Chi Minh City",
          regionCode: "HCM"
        }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates confirmed COD orders and clears cart on placement", async () => {
    const cartItems = [createCartItem()];
    prisma.cartItem.findMany.mockResolvedValue(cartItems);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    );
    prisma.order.create.mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-SHOP-1",
      shopId: "shop-1",
      status: "CONFIRMED",
      paymentMethod: PaymentMethod.COD,
      itemsSubtotal: new Prisma.Decimal(698000),
      shippingFee: new Prisma.Decimal(24000),
      discountTotal: new Prisma.Decimal(0),
      grandTotal: new Prisma.Decimal(722000),
      placedAt: new Date("2026-04-17T00:00:00.000Z")
    });
    prisma.payment.create.mockResolvedValue({
      id: "payment-1",
      status: PaymentStatus.PAID
    });
    prisma.user.findUnique.mockResolvedValue({
      email: "buyer@example.com",
      fullName: "Demo Buyer"
    });

    const result = await service.placeOrder("user-1", {
      paymentMethod: PaymentMethod.COD,
      shippingAddress: {
        recipientName: "Demo Buyer",
        phoneNumber: "0900000000",
        addressLine1: "123 Demo Street",
        district: "District 1",
        province: "Ho Chi Minh City",
        regionCode: "HCM"
      }
    });

    expect(prisma.order.create).toHaveBeenCalled();
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.PAID,
        method: PaymentMethod.COD
      })
    });
    expect(orderStatusHistoryService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        status: "CONFIRMED"
      }),
      prisma
    );
    expect(paymentEventsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "payment-1",
        eventType: "PAYMENT_CREATED",
        nextStatus: PaymentStatus.PAID
      }),
      prisma
    );
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" }
    });
    expect(notificationsService.create).toHaveBeenCalled();
    expect(mailerService.sendSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        subject: expect.stringContaining("Ecoms Marketplace"),
        tags: ["order_placed"]
      })
    );
    expect(result.orders[0]?.status).toBe("CONFIRMED");
  });

  it("applies stacked vouchers in preview and order placement", async () => {
    const cartItems = [createCartItem()];
    prisma.cartItem.findMany.mockResolvedValue(cartItems);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    );
    prisma.order.create.mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-SHOP-1",
      shopId: "shop-1",
      status: "PENDING",
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      itemsSubtotal: new Prisma.Decimal(698000),
      shippingFee: new Prisma.Decimal(0),
      discountTotal: new Prisma.Decimal(143800),
      grandTotal: new Prisma.Decimal(578200),
      placedAt: new Date("2026-04-17T00:00:00.000Z")
    });
    prisma.payment.create.mockResolvedValue({
      id: "payment-1",
      status: PaymentStatus.PENDING
    });
    prisma.user.findUnique.mockResolvedValue({
      email: "buyer@example.com",
      fullName: "Demo Buyer"
    });
    vouchersService.findActiveVoucherByCode.mockImplementation(async (code: string) => {
      if (code === "PLATFORM50K") {
        return {
        id: "voucher-platform",
        code: "PLATFORM50K",
        name: "Platform 50k off",
        scope: VoucherScope.PLATFORM,
        categoryId: null,
        discountType: VoucherDiscountType.FIXED,
        discountValue: new Prisma.Decimal(50000),
        maxDiscountAmount: null,
        minOrderValue: new Prisma.Decimal(300000),
          perUserUsageLimit: 3
        };
      }

      if (code === "SHOP10OFF") {
        return {
        id: "voucher-shop",
        code: "SHOP10OFF",
        name: "Demo shop 10% off",
        scope: VoucherScope.SHOP,
        shopId: "shop-1",
        categoryId: null,
        discountType: VoucherDiscountType.PERCENTAGE,
        discountValue: new Prisma.Decimal(10),
        maxDiscountAmount: new Prisma.Decimal(80000),
        minOrderValue: new Prisma.Decimal(250000),
          perUserUsageLimit: 2
        };
      }

      if (code === "FREESHIP30K") {
        return {
        id: "voucher-freeship",
        code: "FREESHIP30K",
        name: "Freeship 30k",
        scope: VoucherScope.FREESHIP,
        categoryId: null,
        discountType: VoucherDiscountType.FIXED,
        discountValue: new Prisma.Decimal(30000),
        maxDiscountAmount: null,
        minOrderValue: new Prisma.Decimal(200000),
          perUserUsageLimit: 2
        };
      }

      return undefined;
    });

    const payload = {
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      shippingAddress: {
        recipientName: "Demo Buyer",
        phoneNumber: "0900000000",
        addressLine1: "123 Demo Street",
        district: "District 1",
        province: "Ho Chi Minh City",
        regionCode: "HCM"
      },
      vouchers: {
        platformCode: "PLATFORM50K",
        freeshipCode: "FREESHIP30K",
        shopCodes: [{ shopId: "shop-1", code: "SHOP10OFF" }]
      }
    };

    const preview = await service.preview("user-1", payload);
    expect(preview.totals.discountTotal).toBe("143800");
    expect(preview.totals.shippingFee).toBe("0");
    expect(preview.appliedVouchers.map((voucher) => voucher.code)).toEqual([
      "PLATFORM50K",
      "SHOP10OFF",
      "FREESHIP30K"
    ]);

    const result = await service.placeOrder("user-1", payload);
    expect(prisma.voucher.update).toHaveBeenCalledTimes(3);
    expect(prisma.voucherRedemption.create).toHaveBeenCalledTimes(3);
    expect(result.orders[0]?.grandTotal).toBe("578200");
  });

  it("uses configurable payment timeout for pending online payments", async () => {
    const cartItems = [createCartItem()];
    prisma.cartItem.findMany.mockResolvedValue(cartItems);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    );
    systemSettingsService.getNumberValue.mockImplementation(async (key: string) => {
      const mapping: Record<string, number> = {
        payment_timeout_minutes: 25,
        default_product_weight_grams: 300,
        shipping_fee_hn: 18000,
        shipping_fee_hcm: 18000,
        shipping_fee_central: 28000,
        shipping_fee_other: 35000,
        shipping_fee_extra_per_500g: 6000
      };

      return mapping[key] ?? 25;
    });
    systemSettingsService.getPublicSummary.mockResolvedValueOnce({
      marketplaceName: "Ops Demo",
      supportEmail: "ops@example.com",
      paymentTimeoutMinutes: 25,
      orderAutoCompleteDays: 3,
      paymentOnlineGatewayEnabled: true,
      paymentIncidentMessage: null
    });
    prisma.order.create.mockResolvedValue({
      id: "order-2",
      orderNumber: "ORD-SHOP-2",
      shopId: "shop-1",
      status: "PENDING",
      paymentMethod: PaymentMethod.ONLINE_GATEWAY,
      itemsSubtotal: new Prisma.Decimal(698000),
      shippingFee: new Prisma.Decimal(24000),
      discountTotal: new Prisma.Decimal(0),
      grandTotal: new Prisma.Decimal(722000),
      placedAt: new Date("2026-04-17T00:00:00.000Z")
    });
    prisma.payment.create.mockResolvedValue({
      id: "payment-2",
      status: PaymentStatus.PENDING
    });
    prisma.user.findUnique.mockResolvedValue({
      email: "buyer@example.com",
      fullName: "Demo Buyer"
    });

    await service.placeOrder("user-1", {
      paymentMethod: PaymentMethod.ONLINE_GATEWAY,
      shippingAddress: {
        recipientName: "Demo Buyer",
        phoneNumber: "0900000000",
        addressLine1: "123 Demo Street",
        district: "District 1",
        province: "Ho Chi Minh City",
        regionCode: "HCM"
      }
    });

    expect(systemSettingsService.getNumberValue).toHaveBeenCalledWith("payment_timeout_minutes");
    expect(systemSettingsService.getPublicSummary).toHaveBeenCalled();
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.PENDING,
        method: PaymentMethod.ONLINE_GATEWAY,
        expiresAt: expect.any(Date),
        metadata: expect.objectContaining({
          provider: "mock_gateway",
          checkoutMode: "hosted_checkout"
        })
      })
    });
    expect(paymentGatewayService.createPendingPaymentMetadata).toHaveBeenCalled();
    expect(paymentEventsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "payment-2",
        eventType: "PAYMENT_CREATED",
        nextStatus: PaymentStatus.PENDING
      }),
      prisma
    );
  });

  it("uses configurable shipping fee settings in preview", async () => {
    prisma.cartItem.findMany.mockResolvedValue([createCartItem()]);
    systemSettingsService.getNumberValue.mockImplementation(async (key: string) => {
      const mapping: Record<string, number> = {
        payment_timeout_minutes: 15,
        default_product_weight_grams: 300,
        shipping_fee_hn: 21000,
        shipping_fee_hcm: 20000,
        shipping_fee_central: 30000,
        shipping_fee_other: 37000,
        shipping_fee_extra_per_500g: 7000
      };

      return mapping[key] ?? 15;
    });

    const preview = await service.preview("user-1", {
      paymentMethod: PaymentMethod.COD,
      shippingAddress: {
        recipientName: "Demo Buyer",
        phoneNumber: "0900000000",
        addressLine1: "123 Demo Street",
        district: "District 1",
        province: "Ho Chi Minh City",
        regionCode: "HCM"
      }
    });

    expect(preview.totals.shippingFee).toBe("27000");
    expect(preview.totals.grandTotal).toBe("725000");
  });

  it("uses configurable default product weight when product weight is missing", async () => {
    const cartItem = createCartItem();
    cartItem.product.weightGrams = null;
    prisma.cartItem.findMany.mockResolvedValue([cartItem]);
    systemSettingsService.getNumberValue.mockImplementation(async (key: string) => {
      const mapping: Record<string, number> = {
        payment_timeout_minutes: 15,
        default_product_weight_grams: 800,
        shipping_fee_hn: 18000,
        shipping_fee_hcm: 18000,
        shipping_fee_central: 28000,
        shipping_fee_other: 35000,
        shipping_fee_extra_per_500g: 6000
      };

      return mapping[key] ?? 15;
    });

    const preview = await service.preview("user-1", {
      paymentMethod: PaymentMethod.COD,
      shippingAddress: {
        recipientName: "Demo Buyer",
        phoneNumber: "0900000000",
        addressLine1: "123 Demo Street",
        district: "District 1",
        province: "Ho Chi Minh City",
        regionCode: "HCM"
      }
    });

    expect(preview.totals.shippingFee).toBe("36000");
  });

  it("blocks online gateway preview when incident mode disables it", async () => {
    systemSettingsService.getBooleanValue.mockResolvedValue(false);
    systemSettingsService.getStringValue.mockResolvedValue("Gateway under maintenance");

    await expect(
      service.preview("user-1", {
        paymentMethod: PaymentMethod.ONLINE_GATEWAY,
        shippingAddress: {
          recipientName: "Demo Buyer",
          phoneNumber: "0900000000",
          addressLine1: "123 Demo Street",
          district: "District 1",
          province: "Ho Chi Minh City",
          regionCode: "HCM"
        }
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks online gateway placement when incident mode disables it", async () => {
    systemSettingsService.getBooleanValue.mockResolvedValue(false);
    systemSettingsService.getStringValue.mockResolvedValue("Gateway under maintenance");

    await expect(
      service.placeOrder("user-1", {
        paymentMethod: PaymentMethod.ONLINE_GATEWAY,
        shippingAddress: {
          recipientName: "Demo Buyer",
          phoneNumber: "0900000000",
          addressLine1: "123 Demo Street",
          district: "District 1",
          province: "Ho Chi Minh City",
          regionCode: "HCM"
        }
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
