import { Injectable } from "@nestjs/common";
import { ProductStatus, ShopStatus } from "@ecoms/contracts";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      totalUsers,
      totalShops,
      pendingShops,
      totalProducts,
      activeProducts,
      bannedProducts,
      totalOrders,
      pendingPayments,
      totalReviews,
      recentOrders,
      shopsNeedingReview,
      productsNeedingReview
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.shop.count({ where: { deletedAt: null } }),
      this.prisma.shop.count({ where: { deletedAt: null, status: ShopStatus.PENDING_APPROVAL } }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.product.count({ where: { deletedAt: null, status: ProductStatus.ACTIVE } }),
      this.prisma.product.count({ where: { deletedAt: null, status: ProductStatus.BANNED } }),
      this.prisma.order.count(),
      this.prisma.payment.count({ where: { status: "PENDING" } }),
      this.prisma.review.count(),
      this.prisma.order.findMany({
        take: 5,
        orderBy: [{ createdAt: "desc" }],
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          shop: { select: { id: true, name: true, slug: true } }
        }
      }),
      this.prisma.shop.findMany({
        where: {
          deletedAt: null,
          status: ShopStatus.PENDING_APPROVAL
        },
        take: 6,
        orderBy: [{ createdAt: "asc" }],
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      }),
      this.prisma.product.findMany({
        where: {
          deletedAt: null,
          status: {
            in: [ProductStatus.DRAFT, ProductStatus.INACTIVE]
          }
        },
        take: 8,
        orderBy: [{ createdAt: "desc" }],
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      })
    ]);

    return {
      stats: {
        totalUsers,
        totalShops,
        pendingShops,
        totalProducts,
        activeProducts,
        bannedProducts,
        totalOrders,
        pendingPayments,
        totalReviews
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotal: order.grandTotal.toString(),
        createdAt: order.createdAt.toISOString(),
        user: order.user,
        shop: order.shop
      })),
      shopsNeedingReview: shopsNeedingReview.map((shop) => ({
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        status: shop.status,
        createdAt: shop.createdAt.toISOString(),
        owner: shop.owner
      })),
      productsNeedingReview: productsNeedingReview.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        status: product.status,
        salePrice: product.salePrice.toString(),
        createdAt: product.createdAt.toISOString(),
        shop: product.shop
      }))
    };
  }
}
