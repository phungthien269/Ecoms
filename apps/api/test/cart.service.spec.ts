import { ConflictException } from "@nestjs/common";
import { ProductStatus, ShopStatus } from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { CartService } from "../src/modules/cart/cart.service";

describe("CartService", () => {
  const prisma = {
    cartItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn()
    },
    product: {
      findFirst: jest.fn()
    },
    productVariant: {
      findFirst: jest.fn()
    }
  };

  const service = new CartService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds a new cart item and returns grouped shop totals", async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: "product-1",
      stock: 10,
      status: ProductStatus.ACTIVE,
      shop: {
        status: ShopStatus.ACTIVE,
        deletedAt: null
      }
    });
    prisma.cartItem.findFirst.mockResolvedValue(null);
    prisma.cartItem.create.mockResolvedValue(undefined);
    prisma.cartItem.findMany.mockResolvedValue([
      {
        id: "cart-item-1",
        userId: "user-1",
        productId: "product-1",
        productVariantId: null,
        quantity: 2,
        product: {
          id: "product-1",
          name: "Gaming Mouse Pro",
          slug: "gaming-mouse-pro",
          status: ProductStatus.ACTIVE,
          stock: 10,
          salePrice: new Prisma.Decimal(399000),
          shop: {
            id: "shop-1",
            name: "Gear Hub",
            slug: "gear-hub"
          },
          images: [{ url: "https://cdn.example.com/mouse.jpg" }]
        },
        productVariant: null
      }
    ]);

    const result = await service.addItem("user-1", {
      productId: "product-1",
      quantity: 2
    });

    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        productId: "product-1",
        productVariantId: undefined,
        quantity: 2
      }
    });
    expect(result.totals).toEqual({
      itemCount: 2,
      subtotal: "798000"
    });
    expect(result.shops[0]?.shop.slug).toBe("gear-hub");
  });

  it("merges quantity into an existing cart line", async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: "product-1",
      stock: 10,
      status: ProductStatus.ACTIVE,
      shop: {
        status: ShopStatus.ACTIVE,
        deletedAt: null
      }
    });
    prisma.cartItem.findFirst
      .mockResolvedValueOnce({
        id: "cart-item-1",
        quantity: 1
      })
      .mockResolvedValueOnce([]);
    prisma.cartItem.findMany.mockResolvedValue([]);

    await service.addItem("user-1", {
      productId: "product-1",
      quantity: 2
    });

    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: "cart-item-1" },
      data: {
        quantity: 3
      }
    });
  });

  it("rejects adding inactive products to cart", async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: "product-1",
      stock: 10,
      status: ProductStatus.INACTIVE,
      shop: {
        status: ShopStatus.ACTIVE,
        deletedAt: null
      }
    });

    await expect(
      service.addItem("user-1", {
        productId: "product-1",
        quantity: 1
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
