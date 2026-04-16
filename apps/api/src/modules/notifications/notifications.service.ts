import { Injectable, NotFoundException } from "@nestjs/common";
import {
  NotificationCategory,
  type NotificationSummary
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";

interface CreateNotificationInput {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  linkUrl?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  async listOwn(userId: string): Promise<{ items: NotificationSummary[]; unreadCount: number }> {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }],
        take: 50
      }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      })
    ]);

    return {
      items: notifications.map((notification) => ({
        id: notification.id,
        category: notification.category as NotificationCategory,
        title: notification.title,
        body: notification.body,
        linkUrl: notification.linkUrl,
        isRead: notification.isRead,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString()
      })),
      unreadCount
    };
  }

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        category: input.category,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl,
        metadata: input.metadata as Prisma.InputJsonValue | undefined
      }
    });

    const payload = {
      id: notification.id,
      category: notification.category,
      title: notification.title,
      body: notification.body,
      linkUrl: notification.linkUrl,
      isRead: notification.isRead,
      readAt: null,
      createdAt: notification.createdAt.toISOString()
    };

    this.realtimeGateway.emitToUser(input.userId, "notification.created", payload);

    return payload;
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!existing) {
      throw new NotFoundException("Notification not found");
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    this.realtimeGateway.emitToUser(userId, "notification.read", {
      id: updated.id
    });

    return {
      id: updated.id,
      isRead: updated.isRead,
      readAt: updated.readAt?.toISOString() ?? null
    };
  }

  async markAllRead(userId: string) {
    const now = new Date();
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: now
      }
    });

    this.realtimeGateway.emitToUser(userId, "notification.read-all", {
      readAt: now.toISOString()
    });

    return {
      success: true,
      readAt: now.toISOString()
    };
  }
}
