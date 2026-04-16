import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  type FlashSaleSummary,
  type ProductFlashSaleSummary
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFlashSaleDto } from "./dto/create-flash-sale.dto";

const flashSaleInclude = {
  items: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          salePrice: true,
          images: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1
          }
        }
      }
    }
  }
} satisfies Prisma.FlashSaleInclude;

type FlashSaleRecord = Prisma.FlashSaleGetPayload<{
  include: typeof flashSaleInclude;
}>;

@Injectable()
export class FlashSalesService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<FlashSaleSummary[]> {
    const now = new Date();
    const flashSales = await this.prisma.flashSale.findMany({
      where: {
        status: "ACTIVE",
        startsAt: {
          lte: now
        },
        endsAt: {
          gte: now
        }
      },
      include: flashSaleInclude,
      orderBy: [{ startsAt: "asc" }]
    });

    return flashSales.map((flashSale) => this.serializeFlashSale(flashSale));
  }

  async listAdmin(): Promise<FlashSaleSummary[]> {
    const flashSales = await this.prisma.flashSale.findMany({
      include: flashSaleInclude,
      orderBy: [{ createdAt: "desc" }]
    });

    return flashSales.map((flashSale) => this.serializeFlashSale(flashSale));
  }

  async create(payload: CreateFlashSaleDto): Promise<FlashSaleSummary> {
    if (payload.items.length === 0) {
      throw new ConflictException("Flash sale must include at least one product");
    }

    const startsAt = new Date(payload.startsAt);
    const endsAt = new Date(payload.endsAt);
    if (endsAt <= startsAt) {
      throw new ConflictException("Flash sale end time must be later than the start time");
    }

    await this.ensureProductsEligible(payload.items.map((item) => item.productId));

    const created = await this.prisma.flashSale.create({
      data: {
        name: payload.name.trim(),
        description: payload.description?.trim() || undefined,
        bannerUrl: payload.bannerUrl?.trim() || undefined,
        startsAt,
        endsAt,
        status: payload.status ?? this.resolveInitialStatus(startsAt, endsAt),
        items: {
          create: payload.items.map((item, index) => ({
            productId: item.productId,
            flashPrice: new Prisma.Decimal(item.flashPrice),
            stockLimit: item.stockLimit,
            sortOrder: item.sortOrder ?? index
          }))
        }
      },
      include: flashSaleInclude
    });

    return this.serializeFlashSale(created);
  }

  async getActiveItemMap(productIds: string[]) {
    if (productIds.length === 0) {
      return new Map<string, ProductFlashSaleSummary>();
    }

    const now = new Date();
    const items = await this.prisma.flashSaleItem.findMany({
      where: {
        productId: {
          in: productIds
        },
        flashSale: {
          status: "ACTIVE",
          startsAt: {
            lte: now
          },
          endsAt: {
            gte: now
          }
        }
      },
      orderBy: [{ flashSale: { startsAt: "asc" } }],
      include: {
        flashSale: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            salePrice: true,
            images: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              take: 1
            }
          }
        }
      }
    });

    return new Map(
      items.map((item) => [
        item.productId,
        {
          id: item.id,
          flashSaleId: item.flashSaleId,
          flashSaleName: item.flashSale.name,
          flashPrice: item.flashPrice.toString(),
          originalSalePrice: item.product.salePrice.toString(),
          stockLimit: item.stockLimit,
          soldCount: item.soldCount,
          remainingStock: Math.max(0, item.stockLimit - item.soldCount),
          startsAt: item.flashSale.startsAt.toISOString(),
          endsAt: item.flashSale.endsAt.toISOString(),
          status: item.flashSale.status as ProductFlashSaleSummary["status"]
        }
      ])
    );
  }

  private async ensureProductsEligible(productIds: string[]) {
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: productIds
        },
        deletedAt: null
      },
      select: {
        id: true,
        salePrice: true,
        status: true
      }
    });

    if (products.length !== new Set(productIds).size) {
      throw new NotFoundException("One or more flash-sale products were not found");
    }

    for (const product of products) {
      if (product.status !== "ACTIVE") {
        throw new ConflictException("Only active products can be added to a flash sale");
      }
    }
  }

  private resolveInitialStatus(startsAt: Date, endsAt: Date) {
    const now = new Date();
    if (endsAt <= now) {
      return "ENDED";
    }

    if (startsAt <= now && endsAt > now) {
      return "ACTIVE";
    }

    return "SCHEDULED";
  }

  private serializeFlashSale(flashSale: FlashSaleRecord): FlashSaleSummary {
    return {
      id: flashSale.id,
      name: flashSale.name,
      description: flashSale.description,
      bannerUrl: flashSale.bannerUrl,
      startsAt: flashSale.startsAt.toISOString(),
      endsAt: flashSale.endsAt.toISOString(),
      status: flashSale.status as FlashSaleSummary["status"],
      items: flashSale.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSlug: item.product.slug,
        flashPrice: item.flashPrice.toString(),
        originalSalePrice: item.product.salePrice.toString(),
        stockLimit: item.stockLimit,
        soldCount: item.soldCount,
        remainingStock: Math.max(0, item.stockLimit - item.soldCount),
        imageUrl: item.product.images[0]?.url ?? null
      }))
    };
  }
}
