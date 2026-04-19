import { Injectable } from "@nestjs/common";
import { NotificationCategory, OrderStatus, PaymentMethod, PaymentStatus } from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { OrderStatusHistoryService } from "../orderStatusHistory/order-status-history.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentEventsService } from "./payment-events.service";

type StalePaymentWithOrder = Prisma.PaymentGetPayload<{
  include: {
    order: true;
  };
}>;

@Injectable()
export class PaymentLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly orderStatusHistoryService: OrderStatusHistoryService,
    private readonly paymentEventsService: PaymentEventsService
  ) {}

  async expireStalePendingPayments(input?: {
    now?: Date;
    orderIds?: string[];
    userId?: string;
    shopOwnerId?: string;
  }) {
    const now = input?.now ?? new Date();
    const stalePayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        method: {
          not: PaymentMethod.COD
        },
        expiresAt: {
          lt: now
        },
        ...(input?.userId
          ? {
              userId: input.userId
            }
          : {}),
        ...(input?.orderIds?.length
          ? {
              orderId: {
                in: input.orderIds
              }
            }
          : {}),
        ...(input?.shopOwnerId
          ? {
              order: {
                shop: {
                  ownerId: input.shopOwnerId
                }
              }
            }
          : {})
      },
      include: {
        order: true
      }
    });

    let expiredCount = 0;
    let cancelledOrderCount = 0;

    for (const payment of stalePayments) {
      const result = await this.expireSinglePayment(payment, now);
      if (!result) {
        continue;
      }

      expiredCount += 1;
      if (result.orderCancelled) {
        cancelledOrderCount += 1;
      }
    }

    return {
      expiredCount,
      cancelledOrderCount
    };
  }

  private async expireSinglePayment(payment: StalePaymentWithOrder, now: Date) {
    const result = await this.prisma.$transaction(async (tx) => {
      const currentPayment = await tx.payment.findUnique({
        where: {
          id: payment.id
        },
        include: {
          order: true
        }
      });

      if (!currentPayment || currentPayment.status !== PaymentStatus.PENDING) {
        return null;
      }

      await tx.payment.update({
        where: {
          id: currentPayment.id
        },
        data: {
          status: PaymentStatus.EXPIRED,
          metadata: {
            ...(currentPayment.metadata as Record<string, unknown> | null),
            expiredAt: now.toISOString(),
            flow: "auto_payment_timeout"
          }
        }
      });

      await this.paymentEventsService.record(
        {
          paymentId: currentPayment.id,
          orderId: currentPayment.orderId,
          eventType: "PAYMENT_EXPIRED",
          source: "expiry_sweep",
          actorType: "SYSTEM",
          previousStatus: currentPayment.status as PaymentStatus,
          nextStatus: PaymentStatus.EXPIRED,
          payload: {
            occurredAt: now.toISOString(),
            flow: "auto_payment_timeout"
          }
        },
        tx
      );

      let nextOrderStatus = currentPayment.order.status as OrderStatus;
      let orderCancelled = false;
      if (nextOrderStatus === OrderStatus.PENDING) {
        nextOrderStatus = OrderStatus.CANCELLED;
        orderCancelled = true;

        await tx.order.update({
          where: {
            id: currentPayment.orderId
          },
          data: {
            status: OrderStatus.CANCELLED
          }
        });

        await this.orderStatusHistoryService.record(
          {
            orderId: currentPayment.orderId,
            status: OrderStatus.CANCELLED,
            actorType: "PAYMENT_GATEWAY",
            note: "Order auto-cancelled because pending payment expired",
            metadata: {
              paymentId: currentPayment.id,
              paymentStatus: PaymentStatus.EXPIRED,
              occurredAt: now.toISOString(),
              flow: "auto_payment_timeout"
            }
          },
          tx
        );
      }

      return {
        paymentId: currentPayment.id,
        orderId: currentPayment.orderId,
        orderNumber: currentPayment.order.orderNumber,
        userId: currentPayment.userId,
        shopId: currentPayment.order.shopId,
        orderCancelled,
        nextOrderStatus
      };
    });

    if (!result) {
      return null;
    }

    await this.notificationsService.create({
      userId: result.userId,
      category: NotificationCategory.ORDER_STATUS,
      title: "Payment expired",
      body: result.orderCancelled
        ? `${result.orderNumber} was cancelled because payment timed out.`
        : `${result.orderNumber} payment timed out.`,
      linkUrl: `/orders/${result.orderId}`
    });

    if (result.orderCancelled) {
      const seller = await this.prisma.shop.findUnique({
        where: {
          id: result.shopId
        },
        select: {
          ownerId: true
        }
      });

      if (seller) {
        await this.notificationsService.create({
          userId: seller.ownerId,
          category: NotificationCategory.ORDER_STATUS,
          title: "Pending order expired",
          body: `${result.orderNumber} was cancelled because the buyer did not complete payment in time.`,
          linkUrl: "/seller/orders"
        });
      }
    }

    return result;
  }
}
