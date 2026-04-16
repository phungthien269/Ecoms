import { BadRequestException } from "@nestjs/common";
import { PaymentMethod, PaymentStatus, ProductStatus, ShopStatus } from "@ecoms/contracts";
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
    $transaction: jest.fn()
  };

  const service = new CheckoutService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" }
    });
    expect(result.orders[0]?.status).toBe("CONFIRMED");
  });
});
