import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  VoucherDiscountType,
  VoucherScope
} from "@ecoms/contracts";
import { VouchersService } from "../src/modules/vouchers/vouchers.service";

describe("VouchersService", () => {
  const prisma = {
    voucher: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn()
    },
    voucherRedemption: {
      count: jest.fn()
    },
    shop: {
      findUnique: jest.fn()
    },
    category: {
      findUnique: jest.fn()
    }
  };

  const service = new VouchersService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects admin voucher creation when scope is shop", async () => {
    await expect(
      service.createAdminVoucher("admin-1", {
        code: "SHOP10",
        name: "Shop 10",
        scope: VoucherScope.SHOP,
        discountType: VoucherDiscountType.FIXED,
        discountValue: 10000
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates seller voucher for seller shop", async () => {
    prisma.shop.findUnique.mockResolvedValue({ id: "shop-1" });
    prisma.voucher.create.mockResolvedValue({
      id: "voucher-1",
      code: "SHOP10OFF",
      name: "Shop 10% off",
      description: null,
      scope: VoucherScope.SHOP,
      discountType: VoucherDiscountType.PERCENTAGE,
      discountValue: new Prisma.Decimal(10),
      maxDiscountAmount: new Prisma.Decimal(80000),
      minOrderValue: new Prisma.Decimal(250000),
      totalQuantity: 300,
      usedCount: 0,
      perUserUsageLimit: 2,
      startsAt: null,
      expiresAt: null,
      isActive: true,
      createdAt: new Date("2026-04-17T00:00:00.000Z"),
      shop: {
        id: "shop-1",
        name: "Demo Seller Shop",
        slug: "demo-seller-shop"
      },
      category: null
    });

    const voucher = await service.createSellerVoucher("seller-1", {
      code: "shop10off",
      name: "Shop 10% off",
      discountType: VoucherDiscountType.PERCENTAGE,
      discountValue: 10,
      maxDiscountAmount: 80000,
      minOrderValue: 250000,
      totalQuantity: 300,
      perUserUsageLimit: 2
    });

    expect(prisma.voucher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "SHOP10OFF",
          scope: VoucherScope.SHOP,
          shopId: "shop-1"
        })
      })
    );
    expect(voucher.code).toBe("SHOP10OFF");
  });

  it("throws when usage limit is reached", async () => {
    prisma.voucherRedemption.count.mockResolvedValue(2);

    await expect(service.assertVoucherUsageAllowed("voucher-1", "user-1", 2)).rejects.toThrow(
      "Voucher usage limit reached"
    );
  });

  it("throws when active voucher cannot be found", async () => {
    prisma.voucher.findFirst.mockResolvedValue(null);

    await expect(service.findActiveVoucherByCode("MISSING")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
