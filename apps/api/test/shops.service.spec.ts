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
  const auditLogsService = {
    record: jest.fn()
  };
  const systemSettingsService = {
    getBooleanValue: jest.fn().mockResolvedValue(true)
  };

  const service = new ShopsService(
    prisma as never,
    auditLogsService as never,
    systemSettingsService as never
  );

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
      service.updateStatus(
        { sub: "admin-1", email: "admin@example.com", role: UserRole.ADMIN },
        "shop-1",
        { status: ShopStatus.ACTIVE }
      )
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

    const result = await service.updateStatus(
      { sub: "admin-1", email: "admin@example.com", role: UserRole.ADMIN },
      "shop-1",
      { status: ShopStatus.ACTIVE }
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        role: UserRole.SELLER
      }
    });
    expect(result.status).toBe(ShopStatus.ACTIVE);
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "shops.admin.update_status",
        entityId: "shop-1"
      })
    );
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

  it("blocks new shop registration when system setting disables it", async () => {
    systemSettingsService.getBooleanValue.mockResolvedValueOnce(false);

    await expect(
      service.create("seller-1", {
        name: "Blocked Shop"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
