import { OrderStatus, ProductStatus, ShopStatus } from "@ecoms/contracts";
import { SellerDashboardService } from "../src/modules/sellerDashboard/sellerDashboard.service";

describe("SellerDashboardService", () => {
  const prisma = {
    shop: {
      findUnique: jest.fn()
    },
    product: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    order: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn()
    },
    voucher: {
      count: jest.fn()
    },
    review: {
      aggregate: jest.fn()
    },
    chatConversation: {
      findMany: jest.fn()
    }
  };

  const service = new SellerDashboardService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns seller dashboard stats and normalized revenue data", async () => {
    prisma.shop.findUnique.mockResolvedValue({
      id: "shop-1",
      name: "Demo Shop",
      slug: "demo-shop",
      status: ShopStatus.ACTIVE
    });

    prisma.product.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    prisma.order.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(6);

    prisma.voucher.count.mockResolvedValue(5);
    prisma.review.aggregate.mockResolvedValue({
      _avg: {
        rating: 4.25
      },
      _count: {
        _all: 7
      }
    });

    prisma.order.aggregate
      .mockResolvedValueOnce({
        _sum: {
          grandTotal: {
            toString: () => "1200000"
          }
        }
      })
      .mockResolvedValueOnce({
        _sum: {
          grandTotal: {
            toString: () => "450000"
          }
        }
      });

    prisma.chatConversation.findMany.mockResolvedValue([
      {
        lastMessageAt: new Date("2026-04-19T09:00:00.000Z"),
        sellerLastReadAt: null
      },
      {
        lastMessageAt: new Date("2026-04-19T08:00:00.000Z"),
        sellerLastReadAt: new Date("2026-04-19T08:30:00.000Z")
      }
    ]);

    prisma.product.findMany
      .mockResolvedValueOnce([
        {
          id: "product-1",
          name: "Gaming Mouse",
          slug: "gaming-mouse",
          soldCount: 25,
          stock: 20,
          salePrice: {
            toString: () => "350000"
          },
          status: ProductStatus.ACTIVE,
          images: [{ url: "https://cdn.test/mouse.jpg" }]
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "product-2",
          name: "Keyboard",
          slug: "keyboard",
          stock: 2,
          status: ProductStatus.DRAFT,
          images: [{ url: "https://cdn.test/keyboard.jpg" }]
        }
      ]);

    prisma.order.findMany
      .mockResolvedValueOnce([
        {
          id: "order-1",
          orderNumber: "ORD-001",
          status: OrderStatus.PENDING,
          grandTotal: {
            toString: () => "125000"
          },
          placedAt: new Date("2026-04-19T09:30:00.000Z"),
          user: {
            id: "user-1",
            fullName: "Buyer Demo",
            email: "buyer@ecoms.local"
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          placedAt: new Date("2026-04-18T10:00:00.000Z"),
          grandTotal: {
            toString: () => "150000"
          }
        },
        {
          placedAt: new Date("2026-04-18T12:00:00.000Z"),
          grandTotal: {
            toString: () => "50000"
          }
        }
      ]);

    const summary = await service.getSummary("seller-1");

    expect(summary.shop.slug).toBe("demo-shop");
    expect(summary.stats.totalProducts).toBe(12);
    expect(summary.stats.activeProducts).toBe(8);
    expect(summary.stats.lowStockProducts).toBe(3);
    expect(summary.stats.unreadConversations).toBe(1);
    expect(summary.stats.averageRating).toBe("4.25");
    expect(summary.revenue.completedRevenue).toBe("1200000");
    expect(summary.revenue.openOrderValue).toBe("450000");
    expect(summary.topProducts[0]).toEqual(
      expect.objectContaining({
        slug: "gaming-mouse",
        soldCount: 25
      })
    );
    expect(summary.lowStockProducts[0]).toEqual(
      expect.objectContaining({
        slug: "keyboard",
        stock: 2
      })
    );
    expect(summary.attentionOrders[0]).toEqual(
      expect.objectContaining({
        orderNumber: "ORD-001",
        status: OrderStatus.PENDING
      })
    );
    expect(summary.revenue.recentPerformance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-04-18",
          orders: 2,
          revenue: "200000.00"
        })
      ])
    );
  });
});
