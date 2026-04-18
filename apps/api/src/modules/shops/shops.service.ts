import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ProductStatus, ShopStatus, UserRole } from "@ecoms/contracts";
import { AuditLogsService } from "../auditLogs/audit-logs.service";
import type { AuthPayload } from "../auth/types/auth-payload";
import { PrismaService } from "../prisma/prisma.service";
import { SystemSettingsService } from "../systemSettings/system-settings.service";
import { slugify } from "../../common/utils/slugify";
import { CreateShopDto } from "./dto/create-shop.dto";
import { UpdateShopDto } from "./dto/update-shop.dto";
import { UpdateShopStatusDto } from "./dto/update-shop-status.dto";

@Injectable()
export class ShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly systemSettingsService: SystemSettingsService
  ) {}

  async listPublic() {
    const shops = await this.prisma.shop.findMany({
      where: {
        deletedAt: null,
        status: ShopStatus.ACTIVE
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        bannerUrl: true,
        updatedAt: true,
        _count: {
          select: {
            products: {
              where: {
                deletedAt: null,
                status: ProductStatus.ACTIVE
              }
            }
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 500
    });

    return shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      description: shop.description,
      logoUrl: shop.logoUrl,
      bannerUrl: shop.bannerUrl,
      productCount: shop._count.products,
      updatedAt: shop.updatedAt.toISOString()
    }));
  }

  async getPublicShop(shopIdOrSlug: string) {
    const shop = await this.prisma.shop.findFirst({
      where: {
        deletedAt: null,
        status: ShopStatus.ACTIVE,
        OR: [{ id: shopIdOrSlug }, { slug: shopIdOrSlug }]
      },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true
          }
        },
        products: {
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true,
            slug: true,
            salePrice: true,
            originalPrice: true,
            status: true,
            soldCount: true,
            ratingAverage: true,
            images: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              take: 1
            }
          },
          orderBy: [{ createdAt: "desc" }],
          take: 24
        }
      }
    });

    if (!shop) {
      throw new NotFoundException("Shop not found");
    }

    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      description: shop.description,
      logoUrl: shop.logoUrl,
      bannerUrl: shop.bannerUrl,
      owner: shop.owner,
      products: shop.products.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        salePrice: product.salePrice.toString(),
        originalPrice: product.originalPrice.toString(),
        status: product.status,
        soldCount: product.soldCount,
        ratingAverage: product.ratingAverage.toString(),
        imageUrl: product.images[0]?.url ?? null
      }))
    };
  }

  async listAdmin() {
    return this.prisma.shop.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });
  }

  async getOwnShop(ownerId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true
          }
        }
      }
    });

    if (!shop) {
      throw new NotFoundException("Shop not found");
    }

    return shop;
  }

  async create(ownerId: string, payload: CreateShopDto) {
    const registrationEnabled = await this.systemSettingsService.getBooleanValue(
      "seller_registration_enabled"
    );
    if (!registrationEnabled) {
      throw new ConflictException("Seller registration is currently disabled by system configuration");
    }

    const existingShop = await this.prisma.shop.findUnique({
      where: { ownerId }
    });

    if (existingShop) {
      throw new ConflictException("Seller already owns a shop");
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId }
    });

    if (!owner || owner.deletedAt) {
      throw new NotFoundException("Owner not found");
    }

    const slug = await this.generateUniqueSlug(payload.name);
    const shop = await this.prisma.shop.create({
      data: {
        ownerId,
        name: payload.name,
        slug,
        description: payload.description,
        logoUrl: payload.logoUrl,
        bannerUrl: payload.bannerUrl
      }
    });

    if (owner.role !== UserRole.SELLER) {
      await this.prisma.user.update({
        where: { id: ownerId },
        data: {
          role: UserRole.SELLER
        }
      });
    }

    return shop;
  }

  async updateOwnShop(ownerId: string, payload: UpdateShopDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId }
    });

    if (!shop) {
      throw new NotFoundException("Shop not found");
    }

    return this.prisma.shop.update({
      where: { ownerId },
      data: {
        name: payload.name,
        slug: payload.name ? await this.generateUniqueSlug(payload.name, shop.id) : undefined,
        description: payload.description,
        logoUrl: payload.logoUrl,
        bannerUrl: payload.bannerUrl
      }
    });
  }

  async updateStatus(actor: AuthPayload, shopId: string, payload: UpdateShopStatusDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        owner: {
          select: {
            id: true,
            role: true,
            isActive: true
          }
        }
      }
    });

    if (!shop) {
      throw new NotFoundException("Shop not found");
    }

    if (payload.status === ShopStatus.ACTIVE && !shop.owner.isActive) {
      throw new ConflictException("Cannot approve a shop while the owner account is inactive");
    }

    const updatedShop = await this.prisma.$transaction(async (tx) => {
      if (payload.status === ShopStatus.ACTIVE && shop.owner.role !== UserRole.SELLER) {
        await tx.user.update({
          where: { id: shop.owner.id },
          data: {
            role: UserRole.SELLER
          }
        });
      }

      return tx.shop.update({
        where: { id: shopId },
        data: {
          status: payload.status as ShopStatus
        }
      });
    });

    await this.auditLogsService.record({
      actorUserId: actor.sub,
      actorRole: actor.role,
      action: "shops.admin.update_status",
      entityType: "SHOP",
      entityId: shopId,
      summary: `Updated shop ${shop.name} to ${payload.status}`,
      metadata: {
        previousStatus: shop.status,
        nextStatus: payload.status,
        ownerId: shop.owner.id
      }
    });

    return updatedShop;
  }

  private async generateUniqueSlug(name: string, shopId?: string) {
    const baseSlug = slugify(name);
    let candidate = baseSlug;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.shop.findFirst({
        where: {
          slug: candidate,
          ...(shopId
            ? {
                NOT: {
                  id: shopId
                }
              }
            : {})
        }
      });

      if (!existing) {
        return candidate;
      }

      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }
  }
}
