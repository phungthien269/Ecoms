import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ShopStatus, UserRole } from "@ecoms/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { CreateShopDto } from "./dto/create-shop.dto";
import { UpdateShopDto } from "./dto/update-shop.dto";
import { UpdateShopStatusDto } from "./dto/update-shop-status.dto";

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async updateStatus(shopId: string, payload: UpdateShopStatusDto) {
    await this.ensureShopExists(shopId);

    return this.prisma.shop.update({
      where: { id: shopId },
      data: {
        status: payload.status as ShopStatus
      }
    });
  }

  private async ensureShopExists(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId }
    });

    if (!shop) {
      throw new NotFoundException("Shop not found");
    }

    return shop;
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
