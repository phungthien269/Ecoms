import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ProductStatus, ShopStatus } from "@ecoms/contracts";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              take: 1
            },
            shop: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt.toISOString(),
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        salePrice: item.product.salePrice.toString(),
        originalPrice: item.product.originalPrice.toString(),
        ratingAverage: item.product.ratingAverage.toString(),
        soldCount: item.product.soldCount,
        imageUrl: item.product.images[0]?.url ?? null,
        shop: item.product.shop
      }
    }));
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        shop: {
          status: ShopStatus.ACTIVE,
          deletedAt: null
        }
      }
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const existing = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    if (existing) {
      throw new ConflictException("Product already exists in wishlist");
    }

    const created = await this.prisma.wishlistItem.create({
      data: {
        userId,
        productId
      }
    });

    return {
      id: created.id,
      productId: created.productId,
      createdAt: created.createdAt.toISOString()
    };
  }

  async remove(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    if (!existing) {
      throw new NotFoundException("Wishlist item not found");
    }

    await this.prisma.wishlistItem.delete({
      where: { id: existing.id }
    });

    return { removed: true };
  }
}
