import { ConflictException } from "@nestjs/common";
import { ProductStatus } from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { FlashSalesService } from "../src/modules/flashSales/flashSales.service";

describe("FlashSalesService", () => {
  const prisma = {
    flashSale: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    flashSaleItem: {
      findMany: jest.fn()
    },
    product: {
      findMany: jest.fn()
    }
  };

  const service = new FlashSalesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an active flash sale for eligible products", async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: "product-1",
        salePrice: new Prisma.Decimal(399000),
        status: ProductStatus.ACTIVE
      }
    ]);
    prisma.flashSale.create.mockResolvedValue({
      id: "flash-1",
      name: "Mega Tech Hour",
      description: "Hot drop",
      bannerUrl: null,
      startsAt: new Date("2026-04-17T10:00:00.000Z"),
      endsAt: new Date("2099-04-17T12:00:00.000Z"),
      status: "ACTIVE",
      items: [
        {
          id: "item-1",
          productId: "product-1",
          flashPrice: new Prisma.Decimal(299000),
          stockLimit: 40,
          soldCount: 3,
          createdAt: new Date("2026-04-17T09:00:00.000Z"),
          product: {
            id: "product-1",
            name: "Gaming Mouse Pro",
            slug: "gaming-mouse-pro",
            salePrice: new Prisma.Decimal(399000),
            images: [{ url: "https://cdn.example.com/mouse.jpg" }]
          }
        }
      ]
    });

    const result = await service.create({
      name: "Mega Tech Hour",
      startsAt: "2026-04-17T10:00:00.000Z",
      endsAt: "2099-04-17T12:00:00.000Z",
      items: [{ productId: "product-1", flashPrice: 299000, stockLimit: 40 }]
    });

    expect(result.status).toBe("ACTIVE");
    expect(result.items[0]?.remainingStock).toBe(37);
  });

  it("blocks inactive products from joining a flash sale", async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: "product-1",
        salePrice: new Prisma.Decimal(399000),
        status: ProductStatus.DRAFT
      }
    ]);

    await expect(
      service.create({
        name: "Mega Tech Hour",
        startsAt: "2026-04-17T10:00:00.000Z",
        endsAt: "2099-04-17T12:00:00.000Z",
        items: [{ productId: "product-1", flashPrice: 299000, stockLimit: 40 }]
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
