import { Injectable } from "@nestjs/common";
import type { OrderStatus, UserRole } from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type PrismaLike = PrismaService | Prisma.TransactionClient;

interface RecordOrderStatusInput {
  orderId: string;
  status: OrderStatus;
  actorType: string;
  actorUserId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class OrderStatusHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: RecordOrderStatusInput,
    client: PrismaLike = this.prisma
  ) {
    return client.orderStatusHistory.create({
      data: {
        orderId: input.orderId,
        status: input.status,
        actorType: input.actorType,
        actorUserId: input.actorUserId ?? null,
        note: input.note ?? null,
        metadata: input.metadata as Prisma.InputJsonValue | undefined
      }
    });
  }

  async listForOrder(orderId: string) {
    const entries = await this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: [{ createdAt: "asc" }],
      include: {
        actorUser: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      }
    });

    return entries.map((entry) => ({
      id: entry.id,
      status: entry.status,
      actorType: entry.actorType,
      actorUser: entry.actorUser
        ? {
            id: entry.actorUser.id,
            fullName: entry.actorUser.fullName,
            role: entry.actorUser.role as UserRole
          }
        : null,
      note: entry.note,
      metadata: (entry.metadata as Record<string, unknown> | null) ?? null,
      createdAt: entry.createdAt.toISOString()
    }));
  }

  async getLatestStatusTimestamp(orderId: string, status: OrderStatus) {
    const entry = await this.prisma.orderStatusHistory.findFirst({
      where: {
        orderId,
        status
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        createdAt: true
      }
    });

    return entry?.createdAt ?? null;
  }
}
