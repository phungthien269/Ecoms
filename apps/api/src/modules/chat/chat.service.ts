import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  NotificationCategory,
  UserRole,
  type ChatConversationSummary,
  type ChatMessageSummary
} from "@ecoms/contracts";
import { FilesService } from "../files/files.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  async listConversations(userId: string): Promise<ChatConversationSummary[]> {
    const user = await this.getActiveUser(userId);
    const where =
      user.role === UserRole.SELLER
        ? {
            shop: {
              ownerId: userId
            }
          }
        : {
            buyerId: userId
          };

    const conversations = await this.prisma.chatConversation.findMany({
      where,
      include: {
        buyer: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        messages: {
          select: {
            id: true,
            senderId: true,
            createdAt: true
          },
          orderBy: [{ createdAt: "desc" }],
          take: 20
        }
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }]
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      buyer: conversation.buyer,
      shop: conversation.shop,
      product: conversation.product,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      unreadCount: conversation.messages.filter((message) => {
        const readAt =
          user.role === UserRole.SELLER
            ? conversation.sellerLastReadAt
            : conversation.buyerLastReadAt;
        return message.senderId !== userId && (!readAt || message.createdAt > readAt);
      }).length
    }));
  }

  async createConversation(userId: string, payload: CreateConversationDto) {
    const user = await this.getActiveUser(userId);
    if (user.role !== UserRole.CUSTOMER) {
      throw new ConflictException("Only customers can start a buyer-seller conversation");
    }

    const shop = await this.prisma.shop.findFirst({
      where: {
        id: payload.shopId,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        ownerId: true
      }
    });

    if (!shop) {
      throw new NotFoundException("Shop not found");
    }

    let product = null as { id: string; name: string; slug: string } | null;
    if (payload.productId) {
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          id: payload.productId,
          shopId: shop.id,
          deletedAt: null
        },
        select: {
          id: true,
          name: true,
          slug: true
        }
      });

      if (!existingProduct) {
        throw new NotFoundException("Referenced product not found for this shop");
      }

      product = existingProduct;
    }

    const conversation = await this.prisma.chatConversation.upsert({
      where: {
        buyerId_shopId: {
          buyerId: userId,
          shopId: shop.id
        }
      },
      update: {
        productId: payload.productId ?? undefined
      },
      create: {
        buyerId: userId,
        shopId: shop.id,
        productId: payload.productId
      },
      include: {
        buyer: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (payload.initialMessage?.trim()) {
      await this.sendMessage(userId, conversation.id, {
        content: payload.initialMessage.trim(),
        productId: product?.id
      });
    }

    return {
      id: conversation.id,
      buyer: conversation.buyer,
      shop: conversation.shop,
      product: conversation.product,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      unreadCount: 0
    };
  }

  async listMessages(userId: string, conversationId: string): Promise<ChatMessageSummary[]> {
    const { conversation, participantRole } = await this.getAuthorizedConversation(userId, conversationId);

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId: conversation.id
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true
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
      orderBy: [{ createdAt: "asc" }]
    });

    await this.markConversationRead(conversation.id, participantRole);

    return messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      sender: {
        id: message.sender.id,
        fullName: message.sender.fullName,
        role: message.sender.role as UserRole
      },
      content: message.content,
      imageUrl: message.imageUrl,
      product: message.product,
      createdAt: message.createdAt.toISOString()
    }));
  }

  async sendMessage(userId: string, conversationId: string, payload: SendMessageDto) {
    const content = payload.content.trim();
    const imageUrl = payload.imageFileAssetId
      ? (await this.filesService.requireOwnedReadyAsset(userId, payload.imageFileAssetId)).url
      : payload.imageUrl?.trim() || undefined;

    if (!content && !imageUrl) {
      throw new BadRequestException("Message content or image attachment is required");
    }

    const { conversation, participantRole } = await this.getAuthorizedConversation(userId, conversationId);
    const recipientUserId =
      participantRole === "seller" ? conversation.buyerId : conversation.shop.ownerId;

    const createdAt = new Date();
    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        content,
        imageUrl,
        productId: payload.productId || conversation.productId || undefined
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    await this.prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessagePreview: content || "[image]",
        lastMessageAt: createdAt,
        buyerLastReadAt: participantRole === "buyer" ? createdAt : conversation.buyerLastReadAt,
        sellerLastReadAt: participantRole === "seller" ? createdAt : conversation.sellerLastReadAt
      }
    });

    const serializedMessage: ChatMessageSummary = {
      id: message.id,
      conversationId: message.conversationId,
      sender: {
        id: message.sender.id,
        fullName: message.sender.fullName,
        role: message.sender.role as UserRole
      },
      content: message.content,
      imageUrl: message.imageUrl,
      product: message.product,
      createdAt: message.createdAt.toISOString()
    };

    this.realtimeGateway.emitToUsers(
      [conversation.buyerId, conversation.shop.ownerId],
      "chat.message",
      serializedMessage
    );

    await this.notificationsService.create({
      userId: recipientUserId,
      category: NotificationCategory.CHAT,
      title: `New message in ${conversation.shop.name}`,
      body: content || "Sent an image attachment",
      linkUrl: `/chat/${conversation.id}`,
      metadata: {
        conversationId: conversation.id
      }
    });

    return serializedMessage;
  }

  private async getAuthorizedConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            ownerId: true
          }
        }
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (conversation.buyerId === userId) {
      return {
        conversation,
        participantRole: "buyer" as const
      };
    }

    if (conversation.shop.ownerId === userId) {
      return {
        conversation,
        participantRole: "seller" as const
      };
    }

    throw new NotFoundException("Conversation not found");
  }

  private async markConversationRead(conversationId: string, participantRole: "buyer" | "seller") {
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data:
        participantRole === "buyer"
          ? {
              buyerLastReadAt: new Date()
            }
          : {
              sellerLastReadAt: new Date()
            }
    });
  }

  private async getActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
        deletedAt: true
      }
    });

    if (!user || user.deletedAt || !user.isActive) {
      throw new NotFoundException("User not found");
    }

    return {
      id: user.id,
      role: user.role as UserRole
    };
  }
}
