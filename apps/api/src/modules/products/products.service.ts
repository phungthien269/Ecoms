import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ProductStatus, ShopStatus, UserRole } from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { CreateProductDto } from "./dto/create-product.dto";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { UpdateProductStatusDto } from "./dto/update-product-status.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import type { ProductResponseEntity } from "./entities/product-response.entity";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: ProductStatus.ACTIVE,
      shop: {
        status: ShopStatus.ACTIVE,
        deletedAt: null
      },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                description: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                tags: {
                  has: query.search.toLowerCase()
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          images: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
          }
        },
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.product.count({ where })
    ]);

    return {
      items: items.map((item) => this.toProductResponse(item)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async getPublicDetail(productIdOrSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        shop: {
          status: ShopStatus.ACTIVE,
          deletedAt: null
        },
        OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }]
      },
      include: {
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    await this.prisma.product.update({
      where: { id: product.id },
      data: {
        viewCount: {
          increment: 1
        }
      }
    });

    return this.toProductResponse(product);
  }

  async listOwnProducts(ownerId: string) {
    const shop = await this.ensureOwnedShop(ownerId);

    const products = await this.prisma.product.findMany({
      where: {
        shopId: shop.id,
        deletedAt: null
      },
      include: {
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return products.map((item) => this.toProductResponse(item));
  }

  async create(ownerId: string, payload: CreateProductDto) {
    const shop = await this.ensureOwnedShop(ownerId);
    await this.ensureCategoryExists(payload.categoryId);

    if (payload.brandId) {
      await this.ensureBrandExists(payload.brandId);
    }

    const existingSku = await this.prisma.product.findUnique({
      where: { sku: payload.sku }
    });
    if (existingSku) {
      throw new ConflictException("SKU already exists");
    }

    const slug = await this.generateUniqueSlug(payload.name);

    const product = await this.prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: payload.categoryId,
        brandId: payload.brandId,
        name: payload.name,
        slug,
        sku: payload.sku,
        description: payload.description,
        videoUrl: payload.videoUrl,
        originalPrice: payload.originalPrice,
        salePrice: payload.salePrice,
        status: (payload.status ?? ProductStatus.DRAFT) as ProductStatus,
        stock: payload.stock,
        weightGrams: payload.weightGrams,
        lengthCm: payload.lengthCm,
        widthCm: payload.widthCm,
        heightCm: payload.heightCm,
        tags: (payload.tags ?? []).map((tag) => tag.trim().toLowerCase()),
        images: payload.images
          ? {
              create: payload.images.map((image, index) => ({
                url: image.url,
                altText: image.altText,
                sortOrder: image.sortOrder ?? index
              }))
            }
          : undefined
      },
      include: {
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    return this.toProductResponse(product);
  }

  async update(ownerId: string, productId: string, payload: UpdateProductDto) {
    const product = await this.ensureOwnedProduct(ownerId, productId);

    if (payload.categoryId) {
      await this.ensureCategoryExists(payload.categoryId);
    }

    if (payload.brandId) {
      await this.ensureBrandExists(payload.brandId);
    }

    if (payload.sku && payload.sku !== product.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { sku: payload.sku }
      });
      if (existingSku) {
        throw new ConflictException("SKU already exists");
      }
    }

    const imagesOperation =
      payload.images !== undefined
        ? {
            deleteMany: {},
            create: payload.images.map((image, index) => ({
              url: image.url,
              altText: image.altText,
              sortOrder: image.sortOrder ?? index
            }))
          }
        : undefined;

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: payload.name,
        slug: payload.name
          ? await this.generateUniqueSlug(payload.name, productId)
          : undefined,
        sku: payload.sku,
        description: payload.description,
        categoryId: payload.categoryId,
        brandId: payload.brandId,
        videoUrl: payload.videoUrl,
        originalPrice: payload.originalPrice,
        salePrice: payload.salePrice,
        status: payload.status as ProductStatus | undefined,
        stock: payload.stock,
        weightGrams: payload.weightGrams,
        lengthCm: payload.lengthCm,
        widthCm: payload.widthCm,
        heightCm: payload.heightCm,
        tags: payload.tags?.map((tag) => tag.trim().toLowerCase()),
        images: imagesOperation
      },
      include: {
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    return this.toProductResponse(updated);
  }

  async remove(ownerId: string, productId: string) {
    await this.ensureOwnedProduct(ownerId, productId);

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        deletedAt: new Date(),
        status: ProductStatus.INACTIVE
      }
    });

    return { deleted: true };
  }

  async listAdmin() {
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null
      },
      include: {
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        shop: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        category: {
          select: {
            id: true,
            name: true
          }
        },
        brand: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return products.map((item) => ({
      ...this.toProductResponse(item),
      shop: item.shop,
      category: item.category,
      brand: item.brand
    }));
  }

  async updateStatus(productId: string, payload: UpdateProductStatusDto) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null
      }
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        status: payload.status as ProductStatus
      },
      include: {
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    return this.toProductResponse(updated);
  }

  private async ensureOwnedShop(ownerId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId }
    });

    if (!shop || shop.deletedAt) {
      throw new NotFoundException("Seller shop not found");
    }

    return shop;
  }

  private async ensureOwnedProduct(ownerId: string, productId: string) {
    const shop = await this.ensureOwnedShop(ownerId);
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        shopId: shop.id,
        deletedAt: null
      },
      include: {
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return product;
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }
  }

  private async ensureBrandExists(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId }
    });

    if (!brand) {
      throw new NotFoundException("Brand not found");
    }
  }

  private async generateUniqueSlug(name: string, productId?: string) {
    const baseSlug = slugify(name);
    let candidate = baseSlug;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.product.findFirst({
        where: {
          slug: candidate,
          deletedAt: null,
          ...(productId
            ? {
                NOT: {
                  id: productId
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

  private toProductResponse(product: {
    id: string;
    shopId: string;
    categoryId: string;
    brandId: string | null;
    name: string;
    slug: string;
    sku: string;
    description: string;
    videoUrl: string | null;
    originalPrice: Prisma.Decimal;
    salePrice: Prisma.Decimal;
    status: string;
    stock: number;
    weightGrams: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    tags: string[];
    soldCount: number;
    viewCount: number;
    ratingAverage: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
    images: {
      id: string;
      url: string;
      altText: string | null;
      sortOrder: number;
    }[];
  }): ProductResponseEntity {
    return {
      id: product.id,
      shopId: product.shopId,
      categoryId: product.categoryId,
      brandId: product.brandId,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      description: product.description,
      videoUrl: product.videoUrl,
      originalPrice: product.originalPrice.toString(),
      salePrice: product.salePrice.toString(),
      status: product.status as ProductStatus,
      stock: product.stock,
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
      tags: product.tags,
      soldCount: product.soldCount,
      viewCount: product.viewCount,
      ratingAverage: product.ratingAverage.toString(),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        altText: image.altText,
        sortOrder: image.sortOrder
      }))
    };
  }
}
