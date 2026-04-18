import { ConflictException } from "@nestjs/common";
import { ShopStatus, UserRole } from "@ecoms/contracts";
import { ShopsService } from "../src/modules/shops/shops.service";

describe("ShopsService", () => {
  const prisma = {
    $transaction: jest.fn(async (callback: (tx: typeof prisma) => unknown) => callback(prisma)),
    shop: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    user: {
      update: jest.fn()
    }
  };

  const service = new ShopsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks activating shops whose owner is inactive", async () => {
    prisma.shop.findUnique.mockResolvedValue({
      id: "shop-1",
      owner: {
        id: "user-1",
        role: UserRole.SELLER,
        isActive: false
      }
    });

    await expect(
      service.updateStatus("shop-1", { status: ShopStatus.ACTIVE })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("ensures owner role is seller when approving a shop", async () => {
    prisma.shop.findUnique.mockResolvedValue({
      id: "shop-1",
      owner: {
        id: "user-1",
        role: UserRole.CUSTOMER,
        isActive: true
      }
    });
    prisma.shop.update.mockResolvedValue({
      id: "shop-1",
      status: ShopStatus.ACTIVE
    });

    const result = await service.updateStatus("shop-1", { status: ShopStatus.ACTIVE });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        role: UserRole.SELLER
      }
    });
    expect(result.status).toBe(ShopStatus.ACTIVE);
  });

  it("lists active public shops for storefront discovery", async () => {
    prisma.shop.findMany.mockResolvedValue([
      {
        id: "shop-1",
        name: "Demo Shop",
        slug: "demo-shop",
        description: "A storefront",
        logoUrl: null,
        bannerUrl: null,
        updatedAt: new Date("2026-04-19T08:00:00.000Z"),
        _count: {
          products: 12
        }
      }
    ]);

    const result = await service.listPublic();

    expect(prisma.shop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          status: ShopStatus.ACTIVE
        },
        take: 500
      })
    );
    expect(result).toEqual([
      {
        id: "shop-1",
        name: "Demo Shop",
        slug: "demo-shop",
        description: "A storefront",
        logoUrl: null,
        bannerUrl: null,
        productCount: 12,
        updatedAt: "2026-04-19T08:00:00.000Z"
      }
    ]);
  });
});
