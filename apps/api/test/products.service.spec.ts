import { ConflictException } from "@nestjs/common";
import { ProductStatus, ShopStatus } from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { ProductsService } from "../src/modules/products/products.service";

function buildProductRecord(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "product-1",
    shopId: "shop-1",
    categoryId: "category-1",
    brandId: null,
    name: "Gaming Mouse Pro",
    slug: "gaming-mouse-pro",
    sku: "MOUSE-001",
    description: "Precision mouse with programmable DPI profiles.",
    videoUrl: null,
    originalPrice: new Prisma.Decimal(499000),
    salePrice: new Prisma.Decimal(399000),
    status: ProductStatus.DRAFT,
    stock: 30,
    weightGrams: 450,
    lengthCm: 12,
    widthCm: 6,
    heightCm: 4,
    tags: ["gaming", "accessories"],
    soldCount: 0,
    viewCount: 0,
    ratingAverage: new Prisma.Decimal(0),
    createdAt: new Date("2026-04-17T00:00:00.000Z"),
    updatedAt: new Date("2026-04-17T00:00:00.000Z"),
    images: [],
    variants: [],
    ...overrides
  };
}

describe("ProductsService", () => {
  const prisma = {
    shop: {
      findUnique: jest.fn()
    },
    category: {
      findUnique: jest.fn()
    },
    brand: {
      findUnique: jest.fn()
    },
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn()
    },
    productVariant: {
      findUnique: jest.fn()
    }
  };

  const service = new ProductsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.shop.findUnique.mockResolvedValue({
      id: "shop-1",
      ownerId: "seller-1",
      status: ShopStatus.ACTIVE,
      deletedAt: null
    });
    prisma.category.findUnique.mockResolvedValue({
      id: "category-1"
    });
    prisma.brand.findUnique.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.productVariant.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue(
      buildProductRecord({
        images: [
          {
            id: "image-1",
            url: "https://cdn.example.com/mouse.jpg",
            altText: "Gaming Mouse Pro",
            sortOrder: 0,
            createdAt: new Date("2026-04-17T00:00:00.000Z")
          }
        ],
        variants: [
          {
            id: "variant-1",
            sku: "MOUSE-001-BLACK",
            name: "Black",
            attributes: { color: "Black" },
            price: new Prisma.Decimal(399000),
            stock: 12,
            imageUrl: null,
            isDefault: true,
            createdAt: new Date("2026-04-17T00:00:00.000Z")
          },
          {
            id: "variant-2",
            sku: "MOUSE-001-WHITE",
            name: "White",
            attributes: { color: "White" },
            price: null,
            stock: 8,
            imageUrl: null,
            isDefault: false,
            createdAt: new Date("2026-04-17T00:00:00.000Z")
          }
        ]
      })
    );
  });

  it("creates a product with normalized tags and an inferred default variant", async () => {
    const result = await service.create("seller-1", {
      name: "Gaming Mouse Pro",
      sku: "MOUSE-001",
      description: "Precision mouse with programmable DPI profiles.",
      categoryId: "category-1",
      originalPrice: 499000,
      salePrice: 399000,
      stock: 30,
      status: ProductStatus.DRAFT,
      weightGrams: 450,
      lengthCm: 12,
      widthCm: 6,
      heightCm: 4,
      tags: [" Gaming ", "Accessories"],
      images: [
        {
          url: "https://cdn.example.com/mouse.jpg",
          altText: "Gaming Mouse Pro"
        }
      ],
      variants: [
        {
          sku: "MOUSE-001-BLACK",
          name: "Black",
          attributes: { color: "Black" },
          price: 399000,
          stock: 12
        },
        {
          sku: "MOUSE-001-WHITE",
          name: "White",
          attributes: { color: "White" },
          stock: 8
        }
      ]
    });

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: "gaming-mouse-pro",
        tags: ["gaming", "accessories"],
        variants: {
          create: [
            expect.objectContaining({
              sku: "MOUSE-001-BLACK",
              isDefault: true
            }),
            expect.objectContaining({
              sku: "MOUSE-001-WHITE",
              isDefault: false
            })
          ]
        }
      }),
      include: expect.any(Object)
    });
    expect(result.variants[0]?.isDefault).toBe(true);
  });

  it("blocks publishing as active when the shop is not active", async () => {
    prisma.shop.findUnique.mockResolvedValue({
      id: "shop-1",
      ownerId: "seller-1",
      status: ShopStatus.PENDING_APPROVAL,
      deletedAt: null
    });

    await expect(
      service.create("seller-1", {
        name: "Gaming Mouse Pro",
        sku: "MOUSE-001",
        description: "Precision mouse with programmable DPI profiles.",
        categoryId: "category-1",
        originalPrice: 499000,
        salePrice: 399000,
        stock: 30,
        status: ProductStatus.ACTIVE
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects duplicate variant SKUs inside the same product payload", async () => {
    await expect(
      service.create("seller-1", {
        name: "Gaming Mouse Pro",
        sku: "MOUSE-001",
        description: "Precision mouse with programmable DPI profiles.",
        categoryId: "category-1",
        originalPrice: 499000,
        salePrice: 399000,
        stock: 30,
        variants: [
          {
            sku: "MOUSE-001-BLACK",
            name: "Black",
            attributes: { color: "Black" },
            stock: 12
          },
          {
            sku: "MOUSE-001-BLACK",
            name: "Shadow Black",
            attributes: { color: "Shadow Black" },
            stock: 8
          }
        ]
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
