import { ConflictException } from "@nestjs/common";
import { ChatService } from "../src/modules/chat/chat.service";

describe("ChatService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn()
    },
    shop: {
      findFirst: jest.fn()
    },
    product: {
      findFirst: jest.fn()
    },
    chatConversation: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    chatMessage: {
      findMany: jest.fn(),
      create: jest.fn()
    }
  };
  const notificationsService = {
    create: jest.fn()
  };
  const realtimeGateway = {
    emitToUsers: jest.fn()
  };
  const filesService = {
    requireOwnedReadyAsset: jest.fn()
  };

  const service = new ChatService(
    prisma as never,
    filesService as never,
    notificationsService as never,
    realtimeGateway as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    filesService.requireOwnedReadyAsset.mockResolvedValue({
      id: "asset-1",
      url: "https://cdn.example.com/chat-asset.jpg"
    });
  });

  it("prevents sellers from opening buyer conversations", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "seller-1",
      role: "SELLER",
      isActive: true,
      deletedAt: null
    });

    await expect(
      service.createConversation("seller-1", {
        shopId: "shop-1"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("sends a message and emits realtime events", async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      buyerId: "buyer-1",
      productId: "product-1",
      buyerLastReadAt: null,
      sellerLastReadAt: null,
      shop: {
        id: "shop-1",
        name: "Demo Seller Shop",
        ownerId: "seller-1"
      }
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: "message-1",
      conversationId: "conversation-1",
      content: "Hello seller",
      imageUrl: null,
      createdAt: new Date("2026-04-17T00:00:00.000Z"),
      sender: {
        id: "buyer-1",
        fullName: "Demo Buyer",
        role: "CUSTOMER"
      },
      product: null
    });

    const message = await service.sendMessage("buyer-1", "conversation-1", {
      content: "Hello seller"
    });

    expect(message.id).toBe("message-1");
    expect(realtimeGateway.emitToUsers).toHaveBeenCalled();
    expect(notificationsService.create).toHaveBeenCalled();
  });

  it("can send an image attachment through a ready file asset", async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      buyerId: "buyer-1",
      productId: "product-1",
      buyerLastReadAt: null,
      sellerLastReadAt: null,
      shop: {
        id: "shop-1",
        name: "Demo Seller Shop",
        ownerId: "seller-1"
      }
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: "message-2",
      conversationId: "conversation-1",
      content: "",
      imageUrl: "https://cdn.example.com/chat-asset.jpg",
      createdAt: new Date("2026-04-17T00:00:00.000Z"),
      sender: {
        id: "buyer-1",
        fullName: "Demo Buyer",
        role: "CUSTOMER"
      },
      product: null
    });

    const message = await service.sendMessage("buyer-1", "conversation-1", {
      content: "   ",
      imageFileAssetId: "asset-1"
    });

    expect(filesService.requireOwnedReadyAsset).toHaveBeenCalledWith("buyer-1", "asset-1");
    expect(message.imageUrl).toBe("https://cdn.example.com/chat-asset.jpg");
  });
});
