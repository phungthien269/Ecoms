import { ConflictException, NotFoundException } from "@nestjs/common";
import { ReviewsService } from "../src/modules/reviews/reviews.service";

describe("ReviewsService", () => {
  const prisma = {
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    orderItem: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    review: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn()
    }
  };
  const notificationsService = {
    create: jest.fn()
  };
  const filesService = {
    requireOwnedReadyAssets: jest.fn()
  };

  const service = new ReviewsService(
    prisma as never,
    notificationsService as never,
    filesService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.orderItem.findFirst.mockResolvedValue({
      id: "order-item-1",
      productId: "product-1",
      review: null,
      product: {
        id: "product-1"
      }
    });
    prisma.review.create.mockResolvedValue({
      id: "review-1",
      reviewer: {
        id: "user-1",
        fullName: "Demo Buyer"
      },
      rating: 5,
      comment: "Great product",
      imageUrls: [],
      sellerReply: null,
      sellerReplyAt: null,
      createdAt: new Date("2026-04-17T12:00:00.000Z")
    });
    prisma.review.aggregate.mockResolvedValue({
      _avg: {
        rating: 4.5
      }
    });
    filesService.requireOwnedReadyAssets.mockResolvedValue([]);
    prisma.review.findMany.mockResolvedValue([]);
    prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      name: "Gaming Mouse Pro",
      shop: {
        ownerId: "seller-1",
        name: "Demo Seller Shop"
      }
    });
  });

  it("creates a review for an eligible completed order item", async () => {
    const result = await service.create("user-1", {
      orderItemId: "order-item-1",
      rating: 5,
      comment: "Great product"
    });

    expect(result.rating).toBe(5);
    expect(prisma.product.update).toHaveBeenCalled();
  });

  it("blocks duplicate reviews for the same order item", async () => {
    prisma.orderItem.findFirst.mockResolvedValue({
      id: "order-item-1",
      productId: "product-1",
      review: {
        id: "review-1"
      },
      product: {
        id: "product-1"
      }
    });

    await expect(
      service.create("user-1", {
        orderItemId: "order-item-1",
        rating: 5,
        comment: "Great product"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("only allows the owning seller to reply", async () => {
    prisma.review.findFirst.mockResolvedValue({
      id: "review-1",
      product: {
        shop: {
          ownerId: "seller-1"
        }
      }
    });
    prisma.review.update.mockResolvedValue({
      id: "review-1",
      sellerReply: "Thanks",
      sellerReplyAt: new Date("2026-04-17T12:00:00.000Z")
    });
    prisma.review.findFirst
      .mockResolvedValueOnce({
        id: "review-1",
        reviewerId: "user-1",
        product: {
          name: "Gaming Mouse Pro",
          shop: {
            ownerId: "seller-1"
          }
        }
      })
      .mockResolvedValueOnce({
        id: "review-1",
        reviewerId: "user-1",
        product: {
          name: "Gaming Mouse Pro",
          shop: {
            ownerId: "seller-1"
          }
        }
      });

    const result = await service.reply("seller-1", "review-1", "Thanks");
    expect(result.sellerReply).toBe("Thanks");

    await expect(service.reply("seller-2", "review-1", "Thanks")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("lists reviews for the seller's own shop products", async () => {
    prisma.review.findMany.mockResolvedValue([
      {
        id: "review-1",
        rating: 5,
        comment: "Great",
        imageUrls: [],
        sellerReply: null,
        sellerReplyAt: null,
        createdAt: new Date("2026-04-17T12:00:00.000Z"),
        reviewer: {
          id: "user-1",
          fullName: "Demo Buyer",
          email: "buyer@ecoms.local"
        },
        product: {
          id: "product-1",
          name: "Gaming Mouse Pro",
          slug: "gaming-mouse-pro"
        }
      }
    ]);

    const result = await service.listSeller("seller-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.product.slug).toBe("gaming-mouse-pro");
  });

  it("attaches ready file assets to review images", async () => {
    filesService.requireOwnedReadyAssets.mockResolvedValue([
      {
        id: "asset-1",
        url: "https://cdn.example.com/review-1.jpg"
      }
    ]);

    await service.create("user-1", {
      orderItemId: "order-item-1",
      rating: 5,
      comment: "Great product",
      imageFileAssetIds: ["asset-1"]
    });

    expect(filesService.requireOwnedReadyAssets).toHaveBeenCalledWith("user-1", ["asset-1"]);
    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageUrls: ["https://cdn.example.com/review-1.jpg"]
        })
      })
    );
  });
});
