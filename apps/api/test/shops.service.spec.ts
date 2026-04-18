import { ConflictException } from "@nestjs/common";
import { ShopStatus, UserRole } from "@ecoms/contracts";
import { ShopsService } from "../src/modules/shops/shops.service";

describe("ShopsService", () => {
  const prisma = {
    $transaction: jest.fn(async (callback: (tx: typeof prisma) => unknown) => callback(prisma)),
    shop: {
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
});
