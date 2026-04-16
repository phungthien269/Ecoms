import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  VoucherDiscountType,
  VoucherScope,
  type VoucherSummary
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAdminVoucherDto } from "./dto/create-admin-voucher.dto";
import { CreateShopVoucherDto } from "./dto/create-shop-voucher.dto";

const voucherSummaryInclude = {
  shop: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  },
  category: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  }
} satisfies Prisma.VoucherInclude;

type VoucherRecord = Prisma.VoucherGetPayload<{
  include: typeof voucherSummaryInclude;
}>;

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmin(): Promise<VoucherSummary[]> {
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        deletedAt: null
      },
      include: voucherSummaryInclude,
      orderBy: [{ createdAt: "desc" }]
    });

    return vouchers.map((voucher) => this.serializeVoucher(voucher));
  }

  async createAdminVoucher(userId: string, payload: CreateAdminVoucherDto) {
    if (![VoucherScope.PLATFORM, VoucherScope.FREESHIP].includes(payload.scope)) {
      throw new BadRequestException("Admin vouchers can only be platform or freeship scope");
    }

    const categoryId = payload.categoryId || undefined;
    if (categoryId) {
      await this.ensureCategoryExists(categoryId);
    }

    const created = await this.prisma.voucher.create({
      data: {
        code: this.normalizeCode(payload.code),
        name: payload.name.trim(),
        description: payload.description?.trim() || undefined,
        scope: payload.scope,
        discountType: payload.discountType,
        discountValue: new Prisma.Decimal(payload.discountValue),
        maxDiscountAmount: payload.maxDiscountAmount
          ? new Prisma.Decimal(payload.maxDiscountAmount)
          : undefined,
        minOrderValue: payload.minOrderValue
          ? new Prisma.Decimal(payload.minOrderValue)
          : undefined,
        totalQuantity: payload.totalQuantity,
        perUserUsageLimit: payload.perUserUsageLimit ?? 1,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
        categoryId,
        createdByUserId: userId,
        isActive: payload.isActive ?? true
      },
      include: voucherSummaryInclude
    });

    return this.serializeVoucher(created);
  }

  async listSeller(userId: string): Promise<VoucherSummary[]> {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      select: { id: true }
    });

    if (!shop) {
      throw new NotFoundException("Seller shop not found");
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        deletedAt: null,
        shopId: shop.id
      },
      include: voucherSummaryInclude,
      orderBy: [{ createdAt: "desc" }]
    });

    return vouchers.map((voucher) => this.serializeVoucher(voucher));
  }

  async createSellerVoucher(userId: string, payload: CreateShopVoucherDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      select: { id: true }
    });

    if (!shop) {
      throw new NotFoundException("Seller shop not found");
    }

    const categoryId = payload.categoryId || undefined;
    if (categoryId) {
      await this.ensureCategoryExists(categoryId);
    }

    const created = await this.prisma.voucher.create({
      data: {
        code: this.normalizeCode(payload.code),
        name: payload.name.trim(),
        description: payload.description?.trim() || undefined,
        scope: VoucherScope.SHOP,
        discountType: payload.discountType,
        discountValue: new Prisma.Decimal(payload.discountValue),
        maxDiscountAmount: payload.maxDiscountAmount
          ? new Prisma.Decimal(payload.maxDiscountAmount)
          : undefined,
        minOrderValue: payload.minOrderValue
          ? new Prisma.Decimal(payload.minOrderValue)
          : undefined,
        totalQuantity: payload.totalQuantity,
        perUserUsageLimit: payload.perUserUsageLimit ?? 1,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
        categoryId,
        createdByUserId: userId,
        shopId: shop.id,
        isActive: payload.isActive ?? true
      },
      include: voucherSummaryInclude
    });

    return this.serializeVoucher(created);
  }

  async listCheckoutOptions(scope: VoucherScope) {
    const now = new Date();
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        deletedAt: null,
        scope,
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }]
      },
      include: voucherSummaryInclude,
      orderBy: [{ createdAt: "desc" }],
      take: 20
    });

    return vouchers.map((voucher) => this.serializeVoucher(voucher));
  }

  async findActiveVoucherByCode(code: string) {
    const normalizedCode = this.normalizeCode(code);
    const now = new Date();
    const voucher = await this.prisma.voucher.findFirst({
      where: {
        code: normalizedCode,
        deletedAt: null,
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }]
      },
      include: voucherSummaryInclude
    });

    if (!voucher) {
      throw new NotFoundException(`Voucher ${normalizedCode} is not available`);
    }

    if (voucher.totalQuantity !== null && voucher.usedCount >= voucher.totalQuantity) {
      throw new ConflictException(`Voucher ${normalizedCode} has been fully redeemed`);
    }

    return voucher;
  }

  async assertVoucherUsageAllowed(voucherId: string, userId: string, perUserUsageLimit: number) {
    const redemptionCount = await this.prisma.voucherRedemption.count({
      where: {
        voucherId,
        userId
      }
    });

    if (redemptionCount >= perUserUsageLimit) {
      throw new ConflictException("Voucher usage limit reached for this account");
    }
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true }
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private serializeVoucher(voucher: VoucherRecord): VoucherSummary {
    return {
      id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      description: voucher.description,
      scope: voucher.scope as VoucherScope,
      discountType: voucher.discountType as VoucherDiscountType,
      discountValue: voucher.discountValue.toString(),
      maxDiscountAmount: voucher.maxDiscountAmount?.toString() ?? null,
      minOrderValue: voucher.minOrderValue?.toString() ?? null,
      totalQuantity: voucher.totalQuantity,
      usedCount: voucher.usedCount,
      perUserUsageLimit: voucher.perUserUsageLimit,
      startsAt: voucher.startsAt?.toISOString() ?? null,
      expiresAt: voucher.expiresAt?.toISOString() ?? null,
      isActive: voucher.isActive,
      shop: voucher.shop,
      category: voucher.category,
      createdAt: voucher.createdAt.toISOString()
    };
  }
}
