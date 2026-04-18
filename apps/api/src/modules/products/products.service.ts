import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ProductFlashSaleSummary,
  ProductStatus,
  ShopStatus
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { FilesService } from "../files/files.service";
import { FlashSalesService } from "../flashSales/flashSales.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { ListAdminProductsDto } from "./dto/list-admin-products.dto";
import {
  ListProductsQueryDto,
  ProductSortOption
} from "./dto/list-products-query.dto";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly flashSalesService: FlashSalesService,
    private readonly filesService: FilesService
  ) {}

  async listPublic(query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const searchTokens = this.tokenizeSearchQuery(query.search);
    const sort =
      query.sort ?? (searchTokens.length > 0 ? ProductSortOption.RELEVANCE : ProductSortOption.NEWEST);
    const categoryIds = query.categoryIds
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const shopFilter: Prisma.ShopWhereInput = {
      status: ShopStatus.ACTIVE,
      deletedAt: null,
      ...(query.shopSlug ? { slug: query.shopSlug } : {})
    };
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: ProductStatus.ACTIVE,
      shop: {
        is: shopFilter
      },
      ...(categoryIds && categoryIds.length > 0
        ? {
            categoryId: {
              in: categoryIds
            }
          }
        : query.categoryId
          ? { categoryId: query.categoryId }
          : {}),
      ...(query.brandId
        ? { brandId: query.brandId }
        : query.brandSlug
          ? {
              brand: {
                is: {
                  slug: query.brandSlug
                }
              }
            }
          : {}),
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            salePrice: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {})
            }
          }
        : {}),
      ...(query.tag
        ? {
            tags: {
              has: query.tag.trim().toLowerCase()
            }
          }
        : {}),
      ...(query.inStockOnly
        ? {
            OR: [
              {
                stock: {
                  gt: 0
                }
              },
              {
                variants: {
                  some: {
                    stock: {
                      gt: 0
                    }
                  }
                }
              }
            ]
          }
        : {}),
      ...(searchTokens.length > 0 ? this.buildSearchWhere(searchTokens) : {})
    };
    const usesSearchRanking = searchTokens.length > 0 || sort === ProductSortOption.RELEVANCE;

    if (usesSearchRanking) {
      const candidates = await this.prisma.product.findMany({
        where,
        include: productDetailInclude
      });
      const sorted = this.sortSearchCandidates(candidates, sort, searchTokens);
      const total = sorted.length;
      const pagedItems = sorted.slice((page - 1) * pageSize, page * pageSize);

      return {
        items: await this.attachFlashSales(pagedItems),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize))
        }
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productDetailInclude,
        orderBy: this.resolvePublicSort(sort),
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.product.count({ where })
    ]);

    return {
      items: await this.attachFlashSales(items),
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

    const [enrichedProduct] = await this.attachFlashSales([product]);
    return enrichedProduct;
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

    return this.attachFlashSales(products);
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
    const resolvedImages = await this.resolveProductImages(ownerId, payload.images);

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
      images: resolvedImages
        ? {
            create: resolvedImages.map((image, index) => ({
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

    const [enrichedProduct] = await this.attachFlashSales([product]);
    return enrichedProduct;
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
    const resolvedImages =
      payload.images !== undefined
        ? await this.resolveProductImages(ownerId, payload.images)
        : undefined;

    const imagesOperation =
      resolvedImages !== undefined
        ? {
            deleteMany: {},
            create: resolvedImages.map((image, index) => ({
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

    const [enrichedProduct] = await this.attachFlashSales([updated]);
    return enrichedProduct;
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

  async listAdmin(query: ListAdminProductsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
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
                sku: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                slug: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                shop: {
                  is: {
                    name: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              }
            ]
          }
        : {}),
      ...(query.shopStatus
        ? {
            shop: {
              is: {
                status: query.shopStatus
              }
            }
          }
        : {})
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
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
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.product.count({ where })
    ]);

    const enrichedProducts = await this.attachFlashSales(products);

    return {
      items: enrichedProducts.map((item, index) => ({
      ...item,
      shop: products[index]!.shop,
      category: products[index]!.category,
      brand: products[index]!.brand
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
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

    const [enrichedProduct] = await this.attachFlashSales([updated]);
    return enrichedProduct;
  }

  private async attachFlashSales(products: ProductDetailRecord[]) {
    const activeItems = await this.flashSalesService.getActiveItemMap(
      products.map((item) => item.id)
    );

    return products.map((item) =>
      this.toProductResponse(item, activeItems.get(item.id) ?? null)
    );
  }

  private resolvePublicSort(sort: ProductSortOption): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case ProductSortOption.RELEVANCE:
        return [{ soldCount: "desc" }, { ratingAverage: "desc" }, { createdAt: "desc" }];
      case ProductSortOption.PRICE_ASC:
        return [{ salePrice: "asc" }, { createdAt: "desc" }];
      case ProductSortOption.PRICE_DESC:
        return [{ salePrice: "desc" }, { createdAt: "desc" }];
      case ProductSortOption.BEST_SELLING:
        return [{ soldCount: "desc" }, { createdAt: "desc" }];
      case ProductSortOption.TOP_RATED:
        return [{ ratingAverage: "desc" }, { soldCount: "desc" }, { createdAt: "desc" }];
      case ProductSortOption.NEWEST:
      default:
        return [{ createdAt: "desc" }];
    }
  }

  private buildSearchWhere(tokens: string[]): Prisma.ProductWhereInput {
    return {
      AND: tokens.map((token) => ({
        OR: [
          {
            name: {
              contains: token,
              mode: "insensitive"
            }
          },
          {
            description: {
              contains: token,
              mode: "insensitive"
            }
          },
          {
            sku: {
              contains: token,
              mode: "insensitive"
            }
          },
          {
            tags: {
              has: token
            }
          }
        ]
      }))
    };
  }

  private tokenizeSearchQuery(search?: string) {
    return (search ?? "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  private sortSearchCandidates(
    items: ProductDetailRecord[],
    sort: ProductSortOption,
    searchTokens: string[]
  ) {
    const scoredItems = items.map((item) => ({
      item,
      score: this.computeSearchScore(item, searchTokens)
    }));

    return scoredItems
      .sort((left, right) => this.compareSearchCandidates(left, right, sort))
      .map((entry) => entry.item);
  }

  private compareSearchCandidates(
    left: { item: ProductDetailRecord; score: number },
    right: { item: ProductDetailRecord; score: number },
    sort: ProductSortOption
  ) {
    switch (sort) {
      case ProductSortOption.PRICE_ASC:
        return (
          left.item.salePrice.comparedTo(right.item.salePrice) ||
          right.score - left.score ||
          right.item.createdAt.getTime() - left.item.createdAt.getTime()
        );
      case ProductSortOption.PRICE_DESC:
        return (
          right.item.salePrice.comparedTo(left.item.salePrice) ||
          right.score - left.score ||
          right.item.createdAt.getTime() - left.item.createdAt.getTime()
        );
      case ProductSortOption.BEST_SELLING:
        return (
          right.item.soldCount - left.item.soldCount ||
          right.score - left.score ||
          right.item.createdAt.getTime() - left.item.createdAt.getTime()
        );
      case ProductSortOption.TOP_RATED:
        return (
          right.item.ratingAverage.comparedTo(left.item.ratingAverage) ||
          right.item.soldCount - left.item.soldCount ||
          right.score - left.score ||
          right.item.createdAt.getTime() - left.item.createdAt.getTime()
        );
      case ProductSortOption.NEWEST:
        return (
          right.item.createdAt.getTime() - left.item.createdAt.getTime() ||
          right.score - left.score
        );
      case ProductSortOption.RELEVANCE:
      default:
        return (
          right.score - left.score ||
          right.item.soldCount - left.item.soldCount ||
          right.item.ratingAverage.comparedTo(left.item.ratingAverage) ||
          right.item.createdAt.getTime() - left.item.createdAt.getTime()
        );
    }
  }

  private computeSearchScore(product: ProductDetailRecord, searchTokens: string[]) {
    if (searchTokens.length === 0) {
      return 0;
    }

    const normalizedName = product.name.toLowerCase();
    const normalizedDescription = product.description.toLowerCase();
    const normalizedSku = product.sku.toLowerCase();
    const normalizedTags = product.tags.map((tag) => tag.toLowerCase());
    const joinedSearch = searchTokens.join(" ");

    let score = 0;

    if (normalizedName === joinedSearch) {
      score += 180;
    } else if (normalizedName.startsWith(joinedSearch)) {
      score += 120;
    }

    if (normalizedSku === joinedSearch) {
      score += 140;
    } else if (normalizedSku.includes(joinedSearch)) {
      score += 80;
    }

    for (const token of searchTokens) {
      if (normalizedName.includes(token)) {
        score += 42;
      }

      if (normalizedSku.includes(token)) {
        score += 34;
      }

      if (normalizedTags.includes(token)) {
        score += 24;
      }

      if (normalizedDescription.includes(token)) {
        score += 12;
      }
    }

    score += Math.min(product.soldCount, 500) * 0.12;
    score += Number(product.ratingAverage.toString()) * 3;
    score += Math.min(product.viewCount, 1000) * 0.01;

    return score;
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

  private async resolveProductImages(
    ownerId: string,
    images: CreateProductDto["images"]
  ) {
    if (!images || images.length === 0) {
      return [];
    }

    const assetIds = images
      .map((image) => image.fileAssetId?.trim())
      .filter((value): value is string => Boolean(value));
    const assets = await this.filesService.requireOwnedReadyAssets(ownerId, assetIds);
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

    return images.map((image) => {
      const asset = image.fileAssetId ? assetMap.get(image.fileAssetId.trim()) : null;
      const url = asset?.url ?? image.url?.trim();

      if (!url) {
        throw new ConflictException("Each product image requires a URL or ready file asset");
      }

      return {
        url,
        altText: image.altText,
        sortOrder: image.sortOrder
      };
    });
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

  private toProductResponse(
    product: ProductDetailRecord,
    flashSale: ProductFlashSaleSummary | null = null
  ): ProductResponseEntity {
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
      flashSale,
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
