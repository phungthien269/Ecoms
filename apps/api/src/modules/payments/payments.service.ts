import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  NotificationCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus
} from "@ecoms/contracts";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async confirm(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId
      },
      include: {
        order: true
      }
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.method === PaymentMethod.COD) {
      throw new ConflictException("COD payments do not require confirmation");
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException("Only pending payments can be confirmed");
    }

    const now = new Date();
    if (payment.expiresAt && payment.expiresAt < now) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.EXPIRED
        }
      });

      throw new ConflictException("Payment has expired");
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt: now,
          metadata: {
            ...(payment.metadata as Record<string, unknown> | null),
            confirmedAt: now.toISOString(),
            flow: "mock_payment_confirmed"
          }
        }
      }),
      this.prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status:
            payment.order.status === OrderStatus.PENDING
              ? OrderStatus.CONFIRMED
              : payment.order.status
        }
      })
    ]);

    const seller = await this.prisma.shop.findUnique({
      where: { id: payment.order.shopId },
      select: { ownerId: true, name: true }
    });

    await this.notificationsService.create({
      userId,
      category: NotificationCategory.ORDER_STATUS,
      title: "Payment confirmed",
      body: `${payment.order.orderNumber} is now ready for seller processing.`,
      linkUrl: `/orders/${payment.orderId}`
    });

    if (seller) {
      await this.notificationsService.create({
        userId: seller.ownerId,
        category: NotificationCategory.ORDER_STATUS,
        title: `Payment received for ${seller.name}`,
        body: `${payment.order.orderNumber} has been paid and can be confirmed.`,
        linkUrl: "/seller/orders"
      });
    }

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: PaymentStatus.PAID
    };
  }
}
