import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, ProductStatus } from "@ecoms/contracts";
import { PrismaService } from "../prisma/prisma.service";

const LOW_STOCK_THRESHOLD = 5;
const SELLER_OPEN_ORDER_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPING,
  OrderStatus.DELIVERED
] as const;

@Injectable()
export class SellerDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        deletedAt: true
      }
    });

    if (!shop || shop.deletedAt) {
      throw new NotFoundException("Seller shop not found");
    }

    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setHours(0, 0, 0, 0);
    windowStart.setDate(windowStart.getDate() - 6);

    const [
      totalProducts,
      activeProducts,
      draftProducts,
      lowStockProductsCount,
      openOrders,
      returnRequests,
      completedOrders,
      activeVouchers,
      reviewAggregate,
      completedRevenueAggregate,
      openOrderValueAggregate,
      conversations,
      topProducts,
      lowStockProducts,
      attentionOrders,
      recentCompletedOrders
    ] = await Promise.all([
      this.prisma.product.count({
        where: {
          shopId: shop.id,
          deletedAt: null
        }
      }),
      this.prisma.product.count({
        where: {
          shopId: shop.id,
          deletedAt: null,
          status: ProductStatus.ACTIVE
        }
      }),
      this.prisma.product.count({
        where: {
          shopId: shop.id,
          deletedAt: null,
          status: ProductStatus.DRAFT
        }
      }),
      this.prisma.product.count({
        where: {
          shopId: shop.id,
          deletedAt: null,
          status: {
            in: [ProductStatus.ACTIVE, ProductStatus.DRAFT, ProductStatus.INACTIVE]
          },
          stock: {
            lte: LOW_STOCK_THRESHOLD
          }
        }
      }),
      this.prisma.order.count({
        where: {
          shopId: shop.id,
          status: {
            in: [...SELLER_OPEN_ORDER_STATUSES]
          }
        }
      }),
      this.prisma.order.count({
        where: {
          shopId: shop.id,
          status: OrderStatus.RETURN_REQUESTED
        }
      }),
      this.prisma.order.count({
        where: {
          shopId: shop.id,
          status: OrderStatus.COMPLETED
        }
      }),
      this.prisma.voucher.count({
        where: {
          shopId: shop.id,
          deletedAt: null,
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }]
        }
      }),
      this.prisma.review.aggregate({
        where: {
          product: {
            shopId: shop.id
          }
        },
        _avg: {
          rating: true
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.order.aggregate({
        where: {
          shopId: shop.id,
          status: OrderStatus.COMPLETED
        },
        _sum: {
          grandTotal: true
        }
      }),
      this.prisma.order.aggregate({
        where: {
          shopId: shop.id,
          status: {
            in: [...SELLER_OPEN_ORDER_STATUSES, OrderStatus.RETURN_REQUESTED]
          }
        },
        _sum: {
          grandTotal: true
        }
      }),
      this.prisma.chatConversation.findMany({
        where: {
          shopId: shop.id,
          lastMessageAt: {
            not: null
          }
        },
        select: {
          lastMessageAt: true,
          sellerLastReadAt: true
        }
      }),
      this.prisma.product.findMany({
        where: {
          shopId: shop.id,
          deletedAt: null
        },
        select: {
          id: true,
          name: true,
          slug: true,
          soldCount: true,
          stock: true,
          salePrice: true,
          status: true,
          images: {
            select: {
              url: true
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1
          }
        },
        orderBy: [{ soldCount: "desc" }, { updatedAt: "desc" }],
        take: 5
      }),
      this.prisma.product.findMany({
        where: {
          shopId: shop.id,
          deletedAt: null,
          status: {
            in: [ProductStatus.ACTIVE, ProductStatus.DRAFT, ProductStatus.INACTIVE]
          },
          stock: {
            lte: LOW_STOCK_THRESHOLD
          }
        },
        select: {
          id: true,
          name: true,
          slug: true,
          stock: true,
          status: true,
          images: {
            select: {
              url: true
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1
          }
        },
        orderBy: [{ stock: "asc" }, { updatedAt: "desc" }],
        take: 5
      }),
      this.prisma.order.findMany({
        where: {
          shopId: shop.id,
          status: {
            in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.RETURN_REQUESTED]
          }
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          grandTotal: true,
          placedAt: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        },
        orderBy: [{ placedAt: "desc" }],
        take: 5
      }),
      this.prisma.order.findMany({
        where: {
          shopId: shop.id,
          status: OrderStatus.COMPLETED,
          placedAt: {
            gte: windowStart
          }
        },
        select: {
          placedAt: true,
          grandTotal: true
        }
      })
    ]);

    const unreadConversations = conversations.filter((conversation) => {
      if (!conversation.lastMessageAt) {
        return false;
      }

      return (
        !conversation.sellerLastReadAt || conversation.sellerLastReadAt < conversation.lastMessageAt
      );
    }).length;

    return {
      shop,
      stats: {
        totalProducts,
        activeProducts,
        draftProducts,
        lowStockProducts: lowStockProductsCount,
        openOrders,
        returnRequests,
        completedOrders,
        activeVouchers,
        unreadConversations,
        totalReviews: reviewAggregate._count._all,
        averageRating: reviewAggregate._avg.rating?.toFixed(2) ?? "0.00"
      },
      revenue: {
        completedRevenue: completedRevenueAggregate._sum.grandTotal?.toString() ?? "0",
        openOrderValue: openOrderValueAggregate._sum.grandTotal?.toString() ?? "0",
        recentPerformance: this.buildRecentPerformance(windowStart, recentCompletedOrders)
      },
      topProducts: topProducts.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        soldCount: product.soldCount,
        stock: product.stock,
        salePrice: product.salePrice.toString(),
        status: product.status,
        imageUrl: product.images[0]?.url ?? null
      })),
      lowStockProducts: lowStockProducts.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        stock: product.stock,
        status: product.status,
        imageUrl: product.images[0]?.url ?? null
      })),
      attentionOrders: attentionOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotal: order.grandTotal.toString(),
        placedAt: order.placedAt.toISOString(),
        customer: order.user
      }))
    };
  }

  private buildRecentPerformance(
    windowStart: Date,
    orders: Array<{ placedAt: Date; grandTotal: { toString(): string } }>
  ) {
    const buckets = new Map<string, { date: string; revenue: number; orders: number }>();

    for (let index = 0; index < 7; index += 1) {
      const date = new Date(windowStart);
      date.setDate(windowStart.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      buckets.set(key, {
        date: key,
        revenue: 0,
        orders: 0
      });
    }

    for (const order of orders) {
      const key = order.placedAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) {
        continue;
      }

      bucket.revenue += Number(order.grandTotal.toString());
      bucket.orders += 1;
    }

    return [...buckets.values()].map((bucket) => ({
      date: bucket.date,
      revenue: bucket.revenue.toFixed(2),
      orders: bucket.orders
    }));
  }
}
