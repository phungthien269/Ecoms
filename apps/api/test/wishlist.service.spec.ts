import { ConflictException, NotFoundException } from "@nestjs/common";
import { ProductStatus, ShopStatus } from "@ecoms/contracts";
import { WishlistService } from "../src/modules/wishlist/wishlist.service";

describe("WishlistService", () => {
  const prisma = {
    product: {
      findFirst: jest.fn()
    },
    wishlistItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    }
  };

  const service = new WishlistService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findFirst.mockResolvedValue({
      id: "product-1",
      status: ProductStatus.ACTIVE,
      shop: {
        status: ShopStatus.ACTIVE,
        deletedAt: null
      }
    });
    prisma.wishlistItem.findUnique.mockResolvedValue(null);
    prisma.wishlistItem.create.mockResolvedValue({
      id: "wishlist-1",
      productId: "product-1",
      createdAt: new Date("2026-04-17T12:00:00.000Z")
    });
  });

  it("adds an active product to wishlist", async () => {
    const result = await service.add("user-1", "product-1");
    expect(result.productId).toBe("product-1");
  });

  it("rejects duplicate wishlist entries", async () => {
    prisma.wishlistItem.findUnique.mockResolvedValue({
      id: "wishlist-1"
    });

    await expect(service.add("user-1", "product-1")).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("throws when removing a missing wishlist entry", async () => {
    prisma.wishlistItem.findUnique.mockResolvedValue(null);

    await expect(service.remove("user-1", "product-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
