import { ConflictException, UnauthorizedException } from "@nestjs/common";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentWebhookEvent,
  UserRole
} from "@ecoms/contracts";
import { PaymentsService } from "../src/modules/payments/payments.service";

describe("PaymentsService", () => {
  const prisma = {
    payment: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    shop: {
      findUnique: jest.fn()
    },
    order: {
      update: jest.fn()
    },
    $transaction: jest.fn()
  };
  const notificationsService = {
    create: jest.fn()
  };
  const orderStatusHistoryService = {
    record: jest.fn()
  };
  const paymentGatewayService = {
    signWebhookPayload: jest.fn()
  };
  const paymentLifecycleService = {
    expireStalePendingPayments: jest.fn()
  };
  const auditLogsService = {
    record: jest.fn()
  };

  const service = new PaymentsService(
    prisma as never,
    notificationsService as never,
    orderStatusHistoryService as never,
    auditLogsService as never,
    paymentGatewayService as never,
    paymentLifecycleService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    paymentGatewayService.signWebhookPayload.mockImplementation(signWebhookPayload);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    );
  });

  it("confirms a pending non-COD payment and updates the order", async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: "payment-1",
      orderId: "order-1",
      userId: "user-1",
      method: PaymentMethod.ONLINE_GATEWAY,
      status: PaymentStatus.PENDING,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      metadata: {},
      order: {
        id: "order-1",
        status: OrderStatus.PENDING,
        shopId: "shop-1",
        orderNumber: "ORD-1"
      }
    });
    prisma.shop.findUnique.mockResolvedValue({
      ownerId: "seller-1",
      name: "Demo Seller Shop"
    });

    const result = await service.confirm("user-1", "payment-1");

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(orderStatusHistoryService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        status: OrderStatus.CONFIRMED
      }),
      prisma
    );
    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      paymentId: "payment-1",
      orderId: "order-1",
      paymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.CONFIRMED,
      processed: true
    });
  });

  it("rejects COD confirmation requests", async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: "payment-1",
      orderId: "order-1",
      userId: "user-1",
      method: PaymentMethod.COD,
      status: PaymentStatus.PAID,
      order: {
        id: "order-1",
        status: OrderStatus.CONFIRMED,
        shopId: "shop-1",
        orderNumber: "ORD-1"
      }
    });

    await expect(service.confirm("user-1", "payment-1")).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("processes paid webhook idempotently", async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: "payment-2",
      orderId: "order-2",
      userId: "user-1",
      method: PaymentMethod.ONLINE_GATEWAY,
      status: PaymentStatus.PAID,
      referenceCode: "PAY-ORDER-2",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      metadata: {},
      order: {
        id: "order-2",
        status: OrderStatus.CONFIRMED,
        shopId: "shop-1",
        orderNumber: "ORD-2"
      }
    });

    const result = await service.handleMockWebhook(
      {
        paymentId: "payment-2",
        event: PaymentWebhookEvent.PAID
      },
      signWebhookPayload({
        paymentId: "payment-2",
        event: PaymentWebhookEvent.PAID
      })
    );

    expect(result).toEqual({
      paymentId: "payment-2",
      orderId: "order-2",
      paymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.CONFIRMED,
      processed: false
    });
  });

  it("marks failed webhook as cancelled order", async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: "payment-3",
      orderId: "order-3",
      userId: "user-1",
      method: PaymentMethod.ONLINE_GATEWAY,
      status: PaymentStatus.PENDING,
      referenceCode: "PAY-ORDER-3",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      metadata: {},
      order: {
        id: "order-3",
        status: OrderStatus.PENDING,
        shopId: "shop-1",
        orderNumber: "ORD-3"
      }
    });
    prisma.shop.findUnique.mockResolvedValue(null);

    const result = await service.handleMockWebhook(
      {
        paymentId: "payment-3",
        event: PaymentWebhookEvent.FAILED
      },
      signWebhookPayload({
        paymentId: "payment-3",
        event: PaymentWebhookEvent.FAILED
      })
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(orderStatusHistoryService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-3",
        status: OrderStatus.CANCELLED
      }),
      prisma
    );
    expect(result).toEqual({
      paymentId: "payment-3",
      orderId: "order-3",
      paymentStatus: PaymentStatus.FAILED,
      orderStatus: OrderStatus.CANCELLED,
      processed: true
    });
    expect(notificationsService.create).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid webhook signatures", async () => {
    paymentGatewayService.signWebhookPayload.mockReturnValue("expected-signature");

    await expect(
      service.handleMockWebhook(
        {
          paymentId: "payment-4",
          event: PaymentWebhookEvent.PAID
        },
        "bad-signature"
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("delegates stale pending sweep", async () => {
    paymentLifecycleService.expireStalePendingPayments.mockResolvedValue({
      expiredCount: 2,
      cancelledOrderCount: 2
    });

    const result = await service.expireStalePendingPayments();

    expect(paymentLifecycleService.expireStalePendingPayments).toHaveBeenCalledWith();
    expect(result).toEqual({
      expiredCount: 2,
      cancelledOrderCount: 2
    });
  });

  it("replays mock webhook with adapter signature and audit trail", async () => {
    const payload = {
      referenceCode: "PAY-ORDER-9",
      event: PaymentWebhookEvent.PAID,
      providerReference: "provider-9"
    };
    const signature = signWebhookPayload(payload);
    paymentGatewayService.signWebhookPayload.mockReturnValue(signature);
    prisma.payment.findFirst.mockResolvedValue({
      id: "payment-9",
      orderId: "order-9",
      userId: "user-1",
      method: PaymentMethod.ONLINE_GATEWAY,
      status: PaymentStatus.PENDING,
      referenceCode: "PAY-ORDER-9",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      metadata: {},
      order: {
        id: "order-9",
        status: OrderStatus.PENDING,
        shopId: "shop-1",
        orderNumber: "ORD-9"
      }
    });
    prisma.shop.findUnique.mockResolvedValue({
      ownerId: "seller-1",
      name: "Demo Seller Shop"
    });

    const result = await service.replayMockWebhook(
      {
        sub: "admin-1",
        email: "admin@ecoms.local",
        role: UserRole.ADMIN
      },
      payload
    );

    expect(paymentGatewayService.signWebhookPayload).toHaveBeenCalledWith(payload);
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        actorRole: UserRole.ADMIN,
        action: "health.diagnostics.payment_gateway_replay",
        entityType: "HEALTH_DIAGNOSTIC",
        entityId: "PAY-ORDER-9",
        metadata: expect.objectContaining({
          referenceCode: "PAY-ORDER-9",
          event: PaymentWebhookEvent.PAID,
          processed: true,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.CONFIRMED
        })
      })
    );
    expect(result).toEqual({
      paymentId: "payment-9",
      orderId: "order-9",
      paymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.CONFIRMED,
      processed: true
    });
  });
});

function signWebhookPayload(payload: {
  paymentId?: string;
  referenceCode?: string;
  event: PaymentWebhookEvent;
  providerReference?: string;
  occurredAt?: string;
}) {
  const normalized = [
    payload.paymentId ?? "",
    payload.referenceCode ?? "",
    payload.event,
    payload.providerReference ?? "",
    payload.occurredAt ?? ""
  ].join("|");

  return require("node:crypto")
    .createHmac("sha256", "test-payment-secret")
    .update(normalized)
    .digest("hex");
}
