import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  NotificationCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentWebhookEvent
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { MockPaymentWebhookDto } from "./dto/mock-payment-webhook.dto";

type PaymentWithOrder = Prisma.PaymentGetPayload<{
  include: {
    order: true;
  };
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService
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

    return this.applyPaymentTransition(payment, PaymentStatus.PAID, {
      source: "buyer_manual_confirm",
      occurredAt: new Date(),
      metadata: {
        flow: "manual_payment_confirmed"
      }
    });
  }

  async handleMockWebhook(payload: MockPaymentWebhookDto, signature: string | undefined) {
    this.assertWebhookSignature(payload, signature);

    const payment = await this.prisma.payment.findFirst({
      where: payload.paymentId
        ? {
            id: payload.paymentId
          }
        : {
            referenceCode: payload.referenceCode
          },
      include: {
        order: true
      }
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.method === PaymentMethod.COD) {
      throw new ConflictException("COD payments do not accept webhook callbacks");
    }

    const nextStatus = this.mapWebhookEventToStatus(payload.event);
    return this.applyPaymentTransition(payment, nextStatus, {
      source: "mock_webhook",
      occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
      metadata: {
        flow: "mock_webhook",
        webhookEvent: payload.event,
        providerReference: payload.providerReference ?? null
      }
    });
  }

  private async applyPaymentTransition(
    payment: PaymentWithOrder,
    nextStatus: PaymentStatus,
    input: {
      source: string;
      occurredAt: Date;
      metadata: Record<string, unknown>;
    }
  ) {
    if (payment.status === nextStatus) {
      return {
        paymentId: payment.id,
        orderId: payment.orderId,
        paymentStatus: payment.status,
        orderStatus: payment.order.status,
        processed: false
      };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException("Payment is already in a terminal state");
    }

    const currentOrderStatus = payment.order.status as OrderStatus;

    if (nextStatus === PaymentStatus.PAID && payment.expiresAt && payment.expiresAt < input.occurredAt) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.EXPIRED,
          metadata: {
            ...(payment.metadata as Record<string, unknown> | null),
            expiredAt: input.occurredAt.toISOString(),
            flow: "payment_expired_before_confirmation"
          }
        }
      });

      await this.syncOrderForFailedPayment(payment.orderId, currentOrderStatus);
      throw new ConflictException("Payment has expired");
    }

    const orderStatus: OrderStatus =
      nextStatus === PaymentStatus.PAID
        ? currentOrderStatus === OrderStatus.PENDING
          ? OrderStatus.CONFIRMED
          : currentOrderStatus
        : currentOrderStatus === OrderStatus.PENDING
          ? OrderStatus.CANCELLED
          : currentOrderStatus;

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          paidAt: nextStatus === PaymentStatus.PAID ? input.occurredAt : null,
          metadata: {
            ...(payment.metadata as Record<string, unknown> | null),
            ...input.metadata,
            transitionedAt: input.occurredAt.toISOString(),
            paymentStatus: nextStatus
          }
        }
      }),
      this.prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: orderStatus
        }
      })
    ]);

    await this.emitPaymentNotifications(payment, nextStatus, orderStatus);

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      paymentStatus: nextStatus,
      orderStatus,
      processed: true
    };
  }

  private async emitPaymentNotifications(
    payment: PaymentWithOrder,
    paymentStatus: PaymentStatus,
    orderStatus: OrderStatus
  ) {
    const seller = await this.prisma.shop.findUnique({
      where: { id: payment.order.shopId },
      select: { ownerId: true, name: true }
    });

    if (paymentStatus === PaymentStatus.PAID) {
      await this.notificationsService.create({
        userId: payment.userId,
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

      return;
    }

    if (orderStatus === OrderStatus.CANCELLED) {
      await this.notificationsService.create({
        userId: payment.userId,
        category: NotificationCategory.ORDER_STATUS,
        title: "Payment not completed",
        body: `${payment.order.orderNumber} was cancelled because payment did not complete.`,
        linkUrl: `/orders/${payment.orderId}`
      });
    }
  }

  private async syncOrderForFailedPayment(orderId: string, currentOrderStatus: OrderStatus) {
    if (currentOrderStatus !== OrderStatus.PENDING) {
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED
      }
    });
  }

  private mapWebhookEventToStatus(event: PaymentWebhookEvent) {
    switch (event) {
      case PaymentWebhookEvent.PAID:
        return PaymentStatus.PAID;
      case PaymentWebhookEvent.FAILED:
        return PaymentStatus.FAILED;
      case PaymentWebhookEvent.EXPIRED:
        return PaymentStatus.EXPIRED;
      default:
        throw new ConflictException("Unsupported payment webhook event");
    }
  }

  private assertWebhookSignature(payload: MockPaymentWebhookDto, signature: string | undefined) {
    if (!signature) {
      throw new UnauthorizedException("Missing webhook signature");
    }

    const secret = this.configService.get<string>("PAYMENT_WEBHOOK_SECRET");
    const expectedSignature = this.signWebhookPayload(payload, secret);

    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
  }

  private signWebhookPayload(payload: MockPaymentWebhookDto, secret: string | undefined) {
    const normalized = [
      payload.paymentId ?? "",
      payload.referenceCode ?? "",
      payload.event,
      payload.providerReference ?? "",
      payload.occurredAt ?? ""
    ].join("|");

    return createHmac("sha256", secret ?? "change_me_payment_webhook")
      .update(normalized)
      .digest("hex");
  }
}
