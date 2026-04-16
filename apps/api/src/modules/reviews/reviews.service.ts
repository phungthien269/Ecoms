import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, ProductStatus, ShopStatus, type ProductReviewSummary } from "@ecoms/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReviewDto } from "./dto/create-review.dto";

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProduct(productIdOrSlug: string): Promise<ProductReviewSummary[]> {
    const product = await this.prisma.product.findFirst({
      where: {
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        shop: {
          deletedAt: null,
          status: ShopStatus.ACTIVE
        },
        OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }]
      }
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const reviews = await this.prisma.review.findMany({
      where: { productId: product.id },
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return reviews.map((review) => ({
      id: review.id,
      reviewer: review.reviewer,
      rating: review.rating,
      comment: review.comment,
      imageUrls: review.imageUrls,
      sellerReply: review.sellerReply,
      sellerReplyAt: review.sellerReplyAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString()
    }));
  }

  async listEligible(userId: string) {
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: {
          userId,
          status: OrderStatus.COMPLETED
        },
        review: null
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            placedAt: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return orderItems.map((item) => ({
      orderItemId: item.id,
      quantity: item.quantity,
      product: item.product,
      order: {
        ...item.order,
        placedAt: item.order.placedAt.toISOString()
      }
    }));
  }

  async listSeller(userId: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        product: {
          shop: {
            ownerId: userId
          }
        }
      },
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      imageUrls: review.imageUrls,
      sellerReply: review.sellerReply,
      sellerReplyAt: review.sellerReplyAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
      reviewer: review.reviewer,
      product: review.product
    }));
  }

  async listAdmin() {
    const reviews = await this.prisma.review.findMany({
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
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

    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      imageUrls: review.imageUrls,
      sellerReply: review.sellerReply,
      sellerReplyAt: review.sellerReplyAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
      reviewer: review.reviewer,
      product: review.product
    }));
  }

  async create(userId: string, payload: CreateReviewDto) {
    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        id: payload.orderItemId,
        order: {
          userId,
          status: OrderStatus.COMPLETED
        }
      },
      include: {
        review: true,
        product: {
          select: {
            id: true
          }
        }
      }
    });

    if (!orderItem) {
      throw new NotFoundException("Eligible order item not found");
    }

    if (orderItem.review) {
      throw new ConflictException("This order item has already been reviewed");
    }

    const review = await this.prisma.review.create({
      data: {
        reviewerId: userId,
        productId: orderItem.productId,
        orderItemId: orderItem.id,
        rating: payload.rating,
        comment: payload.comment.trim(),
        imageUrls: (payload.imageUrls ?? []).slice(0, 5)
      },
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });

    await this.refreshProductRating(orderItem.product.id);

    return {
      id: review.id,
      reviewer: review.reviewer,
      rating: review.rating,
      comment: review.comment,
      imageUrls: review.imageUrls,
      sellerReply: review.sellerReply,
      sellerReplyAt: review.sellerReplyAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString()
    };
  }

  async reply(userId: string, reviewId: string, reply: string) {
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId
      },
      include: {
        product: {
          include: {
            shop: {
              select: {
                ownerId: true
              }
            }
          }
        }
      }
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    if (review.product.shop.ownerId !== userId) {
      throw new NotFoundException("Review not found");
    }

    const updated = await this.prisma.review.update({
      where: { id: review.id },
      data: {
        sellerReply: reply.trim(),
        sellerReplyAt: new Date()
      }
    });

    return {
      id: updated.id,
      sellerReply: updated.sellerReply,
      sellerReplyAt: updated.sellerReplyAt?.toISOString() ?? null
    };
  }

  private async refreshProductRating(productId: string) {
    const aggregate = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true }
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAverage: aggregate._avg.rating ?? 0
      }
    });
  }
}
