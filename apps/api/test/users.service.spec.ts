import { ConflictException, ForbiddenException } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { UsersService } from "../src/modules/users/users.service";

describe("UsersService", () => {
  const prisma = {
    $transaction: jest.fn(async (callback: (tx: typeof prisma) => unknown) => callback(prisma)),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    shop: {
      update: jest.fn(),
      findUnique: jest.fn()
    }
  };

  const service = new UsersService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists admin users with shop summary", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "seller@example.com",
        fullName: "Seller Demo",
        phoneNumber: null,
        role: UserRole.SELLER,
        isActive: true,
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
        shop: {
          id: "shop-1",
          name: "Demo Shop",
          slug: "demo-shop",
          status: "ACTIVE"
        }
      }
    ]);

    const result = await service.listAdmin();
    expect(result[0]).toMatchObject({
      id: "user-1",
      role: UserRole.SELLER,
      shop: {
        id: "shop-1"
      }
    });
  });

  it("lets admin deactivate customer accounts", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "admin-1",
        role: UserRole.ADMIN,
        deletedAt: null,
        shop: null
      })
      .mockResolvedValueOnce({
        id: "buyer-1",
        role: UserRole.CUSTOMER,
        deletedAt: null,
        shop: null
      });
    prisma.user.update.mockResolvedValue({
      id: "buyer-1",
      email: "buyer@example.com",
      fullName: "Buyer Demo",
      phoneNumber: null,
      role: UserRole.CUSTOMER,
      isActive: false,
      createdAt: new Date("2026-04-18T00:00:00.000Z")
    });

    const result = await service.updateAdminUser(
      {
        sub: "admin-1",
        email: "admin@example.com",
        role: UserRole.ADMIN
      },
      "buyer-1",
      {
        isActive: false
      }
    );

    expect(result.isActive).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "buyer-1" },
      data: {
        role: undefined,
        isActive: false
      }
    });
  });

  it("blocks admin from managing admin-level users", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "admin-1",
        role: UserRole.ADMIN,
        deletedAt: null,
        shop: null
      })
      .mockResolvedValueOnce({
        id: "admin-2",
        role: UserRole.ADMIN,
        deletedAt: null,
        shop: null
      });

    await expect(
      service.updateAdminUser(
        {
          sub: "admin-1",
          email: "admin@example.com",
          role: UserRole.ADMIN
        },
        "admin-2",
        {
          isActive: false
        }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks demoting seller accounts that still own a shop", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "super-1",
        role: UserRole.SUPER_ADMIN,
        deletedAt: null,
        shop: null
      })
      .mockResolvedValueOnce({
        id: "seller-1",
        role: UserRole.SELLER,
        deletedAt: null,
        shop: {
          id: "shop-1",
          status: "ACTIVE"
        }
      });

    await expect(
      service.updateAdminUser(
        {
          sub: "super-1",
          email: "super@example.com",
          role: UserRole.SUPER_ADMIN
        },
        "seller-1",
        {
          role: "CUSTOMER"
        }
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
