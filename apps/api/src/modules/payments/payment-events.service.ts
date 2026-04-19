import { Injectable } from "@nestjs/common";
import type { PaymentEventSummary, PaymentStatus, UserRole } from "@ecoms/contracts";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymentEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: {
      paymentId: string;
      orderId: string;
      eventType: string;
      source: string;
      actorType: string;
      actorUserId?: string | null;
      previousStatus?: PaymentStatus | null;
      nextStatus: PaymentStatus;
      payload?: Record<string, unknown> | null;
    },
    prisma: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    return prisma.paymentEvent.create({
      data: {
        paymentId: input.paymentId,
        orderId: input.orderId,
        eventType: input.eventType,
        source: input.source,
        actorType: input.actorType,
        actorUserId: input.actorUserId ?? undefined,
        previousStatus: input.previousStatus ?? undefined,
        nextStatus: input.nextStatus,
        payload: input.payload as Prisma.InputJsonValue | undefined
      }
    });
  }

  async listForPayment(paymentId: string): Promise<PaymentEventSummary[]> {
    const events = await this.prisma.paymentEvent.findMany({
      where: {
        paymentId
      },
      include: {
        actorUser: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });

    return events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      source: event.source,
      actorType: event.actorType,
      actorUser: event.actorUser
        ? {
            id: event.actorUser.id,
            fullName: event.actorUser.fullName,
            role: event.actorUser.role as UserRole
          }
        : null,
      previousStatus: (event.previousStatus as PaymentStatus | null) ?? null,
      nextStatus: event.nextStatus as PaymentStatus,
      payload: (event.payload as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt.toISOString()
    }));
  }
}
