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

const productDetailInclude = {
  images: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  },
  variants: {
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
  }
} satisfies Prisma.ProductInclude;

type ProductDetailRecord = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

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
        include: productDetailInclude,
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
        ...productDetailInclude
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
        ...productDetailInclude
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

    await this.ensureVariantSkusAvailable(payload.variants);
    const slug = await this.generateUniqueSlug(payload.name);

    const createData: Prisma.ProductCreateInput = {
      shop: {
        connect: {
          id: shop.id
        }
      },
      category: {
        connect: {
          id: payload.categoryId
        }
      },
      brand: payload.brandId
        ? {
            connect: {
              id: payload.brandId
            }
          }
        : undefined,
      name: payload.name,
      slug,
      sku: payload.sku,
      description: payload.description,
      videoUrl: payload.videoUrl,
      originalPrice: payload.originalPrice,
      salePrice: payload.salePrice,
      status: this.resolveRequestedStatus(shop.status as ShopStatus, payload.status),
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
        : undefined,
      variants: payload.variants
        ? {
            create: this.normalizeVariants(payload.variants)
          }
        : undefined
    };

    const product = await this.prisma.product.create({
      data: createData,
      include: productDetailInclude
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

    await this.ensureVariantSkusAvailable(payload.variants, productId);

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

    const variantsOperation =
      payload.variants !== undefined
        ? {
            deleteMany: {},
            create: this.normalizeVariants(payload.variants)
          }
        : undefined;

    const updateData: Prisma.ProductUpdateInput = {
      name: payload.name,
      slug: payload.name
        ? await this.generateUniqueSlug(payload.name, productId)
        : undefined,
      sku: payload.sku,
      description: payload.description,
      category: payload.categoryId
        ? {
            connect: {
              id: payload.categoryId
            }
          }
        : undefined,
      brand:
        payload.brandId === undefined
          ? undefined
          : payload.brandId
            ? {
                connect: {
                  id: payload.brandId
                }
              }
            : {
                disconnect: true
              },
      videoUrl: payload.videoUrl,
      originalPrice: payload.originalPrice,
      salePrice: payload.salePrice,
      status:
        payload.status !== undefined
          ? this.resolveRequestedStatus(product.shop.status as ShopStatus, payload.status)
          : undefined,
      stock: payload.stock,
      weightGrams: payload.weightGrams,
      lengthCm: payload.lengthCm,
      widthCm: payload.widthCm,
      heightCm: payload.heightCm,
      tags: payload.tags?.map((tag) => tag.trim().toLowerCase()),
      images: imagesOperation,
      variants: variantsOperation
    };

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: productDetailInclude
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
        ...productDetailInclude,
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
      },
      include: {
        ...productDetailInclude
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
        },
        variants: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
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
        ...productDetailInclude,
        shop: {
          select: {
            id: true,
            status: true
          }
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

  private async ensureVariantSkusAvailable(
    variants: CreateProductDto["variants"],
    productId?: string
  ) {
    if (!variants || variants.length === 0) {
      return;
    }

    const seenSkus = new Set<string>();
    for (const variant of variants) {
      if (seenSkus.has(variant.sku)) {
        throw new ConflictException("Variant SKUs must be unique within the product");
      }
      seenSkus.add(variant.sku);

      const existing = await this.prisma.productVariant.findUnique({
        where: { sku: variant.sku }
      });

      if (existing && (!productId || existing.productId !== productId)) {
        throw new ConflictException(`Variant SKU ${variant.sku} already exists`);
      }
    }
  }

  private normalizeVariants(variants: NonNullable<CreateProductDto["variants"]>) {
    const hasExplicitDefault = variants.some((variant) => variant.isDefault);

    return variants.map((variant, index) => ({
      sku: variant.sku,
      name: variant.name,
      attributes: variant.attributes,
      price: variant.price,
      stock: variant.stock,
      imageUrl: variant.imageUrl,
      isDefault: hasExplicitDefault ? Boolean(variant.isDefault) : index === 0
    }));
  }

  private resolveRequestedStatus(
    shopStatus: ShopStatus,
    requestedStatus?: ProductStatus
  ): ProductStatus {
    const targetStatus = requestedStatus ?? ProductStatus.DRAFT;

    if (targetStatus === ProductStatus.ACTIVE && shopStatus !== ShopStatus.ACTIVE) {
      throw new ConflictException(
        "Only approved and active shops can publish products as ACTIVE"
      );
    }

    return targetStatus;
  }

  private toProductResponse(product: ProductDetailRecord): ProductResponseEntity {
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
      })),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        attributes: variant.attributes as Record<string, string>,
        price: variant.price?.toString() ?? null,
        stock: variant.stock,
        imageUrl: variant.imageUrl,
        isDefault: variant.isDefault
      }))
    };
  }
}
