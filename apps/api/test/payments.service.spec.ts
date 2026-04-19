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
      findMany: jest.fn(),
      count: jest.fn(),
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
    record: jest.fn(),
    listPaymentIncidentActivity: jest.fn()
  };
  const paymentEventsService = {
    record: jest.fn(),
    listForPayment: jest.fn()
  };
  const systemSettingsService = {
    getPublicSummary: jest.fn()
  };

  const service = new PaymentsService(
    prisma as never,
    notificationsService as never,
    orderStatusHistoryService as never,
    auditLogsService as never,
    paymentEventsService as never,
    paymentGatewayService as never,
    paymentLifecycleService as never,
    systemSettingsService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    paymentGatewayService.signWebhookPayload.mockImplementation(signWebhookPayload);
    paymentGatewayService.getProviderDiagnostics = jest.fn().mockReturnValue({
      provider: "mock_gateway",
      displayName: "Mock Gateway",
      mode: "mock_gateway",
      configured: true,
      webhookMode: "internal_mock",
      supportsHostedCheckout: true,
      supportsBankTransfer: true,
      supportsWebhookReplay: true,
      merchantCode: "demo-merchant",
      baseUrl: "https://gateway.local",
      actionHint: "No action required"
    });
    systemSettingsService.getPublicSummary.mockResolvedValue({
      marketplaceName: "Ecoms Marketplace",
      supportEmail: "support@ecoms.local",
      paymentTimeoutMinutes: 15,
      orderAutoCompleteDays: 3,
      paymentOnlineGatewayEnabled: false,
      paymentIncidentMessage: "Gateway paused"
    });
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      return (input as (tx: typeof prisma) => unknown)(prisma);
    });
  });

  it("returns payment incident center with pending queue and activity", async () => {
    const pendingCreatedAt = new Date(Date.now() - 20 * 60 * 1000);
    const pendingExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    auditLogsService.listPaymentIncidentActivity.mockResolvedValue([
      {
        id: "audit-1",
        actorRole: UserRole.SUPER_ADMIN,
        action: "system_settings.admin.update",
        entityType: "SYSTEM_SETTING",
        entityId: "payment_online_gateway_enabled",
        summary: "Paused online gateway",
        metadata: null,
        createdAt: "2026-04-20T12:00:00.000Z",
        actorUser: {
          id: "super-1",
          fullName: "Super Admin",
          email: "super@ecoms.local"
        }
      }
    ]);
    prisma.payment.findMany
      .mockResolvedValueOnce([
        {
          id: "payment-pending-1",
          referenceCode: "PAY-PENDING-1",
          amount: new (require("@prisma/client").Prisma.Decimal)(722000),
          status: PaymentStatus.PENDING,
          createdAt: pendingCreatedAt,
          expiresAt: pendingExpiresAt,
          user: {
            id: "user-1",
            fullName: "Demo Buyer",
            email: "buyer@ecoms.local"
          },
          order: {
            id: "order-1",
            orderNumber: "ORD-1",
            status: OrderStatus.PENDING,
            shop: {
              id: "shop-1",
              name: "Demo Shop",
              slug: "demo-shop"
            }
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "payment-failed-1",
          referenceCode: "PAY-FAILED-1",
          amount: new (require("@prisma/client").Prisma.Decimal)(722000),
          status: PaymentStatus.FAILED,
          updatedAt: new Date("2026-04-20T12:30:00.000Z"),
          user: {
            id: "user-2",
            fullName: "Buyer 2",
            email: "buyer2@ecoms.local"
          },
          order: {
            id: "order-2",
            orderNumber: "ORD-2",
            status: OrderStatus.CANCELLED,
            shop: {
              id: "shop-1",
              name: "Demo Shop",
              slug: "demo-shop"
            }
          }
        }
      ]);

    const result = await service.getAdminIncidentCenter();

    expect(result.gateway.enabled).toBe(false);
    expect(result.impact.pendingCount).toBe(1);
    expect(result.impact.recentFailedOrExpiredCount).toBe(1);
    expect(result.impact.pendingAgeBuckets).toEqual({
      underFiveMinutes: 0,
      fiveToFifteenMinutes: 0,
      overFifteenMinutes: 1
    });
    expect(result.impact.recentFailureBreakdown).toEqual({
      failed: 1,
      expired: 0
    });
    expect(result.pendingPayments[0]?.referenceCode).toBe("PAY-PENDING-1");
    expect(result.activity).toHaveLength(1);
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
    expect(paymentEventsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "payment-1",
        eventType: "PAYMENT_PAID",
        previousStatus: PaymentStatus.PENDING,
        nextStatus: PaymentStatus.PAID
      }),
      prisma
    );
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
    expect(paymentEventsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "payment-3",
        eventType: "PAYMENT_FAILED",
        previousStatus: PaymentStatus.PENDING,
        nextStatus: PaymentStatus.FAILED
      }),
      prisma
    );
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

  it("returns admin payment trace with payment events", async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: "payment-trace-1",
      orderId: "order-trace-1",
      userId: "user-1",
      method: PaymentMethod.ONLINE_GATEWAY,
      status: PaymentStatus.PAID,
      amount: new (require("@prisma/client").Prisma.Decimal)(722000),
      referenceCode: "PAY-TRACE-1",
      expiresAt: new Date("2026-04-20T10:15:00.000Z"),
      paidAt: new Date("2026-04-20T10:05:00.000Z"),
      metadata: { provider: "mock_gateway" },
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:05:00.000Z"),
      user: {
        id: "user-1",
        fullName: "Demo Buyer",
        email: "buyer@ecoms.local"
      },
      order: {
        id: "order-trace-1",
        orderNumber: "ORD-TRACE-1",
        status: OrderStatus.CONFIRMED,
        shop: {
          id: "shop-1",
          name: "Demo Shop",
          slug: "demo-shop"
        }
      }
    });
    paymentEventsService.listForPayment.mockResolvedValue([
      {
        id: "event-1",
        eventType: "PAYMENT_CREATED",
        source: "checkout",
        actorType: "CHECKOUT",
        actorUser: null,
        previousStatus: null,
        nextStatus: PaymentStatus.PENDING,
        payload: null,
        createdAt: "2026-04-20T10:00:00.000Z"
      }
    ]);

    const result = await service.getAdminTrace({
      referenceCode: "PAY-TRACE-1"
    });

    expect(paymentEventsService.listForPayment).toHaveBeenCalledWith("payment-trace-1");
    expect(result).toEqual({
      payment: {
        id: "payment-trace-1",
        orderId: "order-trace-1",
        orderNumber: "ORD-TRACE-1",
        orderStatus: OrderStatus.CONFIRMED,
        user: {
          id: "user-1",
          fullName: "Demo Buyer",
          email: "buyer@ecoms.local"
        },
        shop: {
          id: "shop-1",
          name: "Demo Shop",
          slug: "demo-shop"
        },
        method: PaymentMethod.ONLINE_GATEWAY,
        status: PaymentStatus.PAID,
        amount: "722000",
        referenceCode: "PAY-TRACE-1",
        expiresAt: "2026-04-20T10:15:00.000Z",
        paidAt: "2026-04-20T10:05:00.000Z",
        metadata: { provider: "mock_gateway" },
        createdAt: "2026-04-20T10:00:00.000Z",
        updatedAt: "2026-04-20T10:05:00.000Z"
      },
      events: [
        {
          id: "event-1",
          eventType: "PAYMENT_CREATED",
          source: "checkout",
          actorType: "CHECKOUT",
          actorUser: null,
          previousStatus: null,
          nextStatus: PaymentStatus.PENDING,
          payload: null,
          createdAt: "2026-04-20T10:00:00.000Z"
        }
      ]
    });
  });

  it("lists admin payments with recent events", async () => {
    prisma.payment.findMany.mockResolvedValue([
      {
        id: "payment-list-1",
        method: PaymentMethod.ONLINE_GATEWAY,
        status: PaymentStatus.PENDING,
        amount: new (require("@prisma/client").Prisma.Decimal)(722000),
        referenceCode: "PAY-LIST-1",
        expiresAt: new Date("2026-04-20T10:15:00.000Z"),
        paidAt: null,
        createdAt: new Date("2026-04-20T10:00:00.000Z"),
        updatedAt: new Date("2026-04-20T10:00:00.000Z"),
        user: {
          id: "user-1",
          fullName: "Demo Buyer",
          email: "buyer@ecoms.local"
        },
        order: {
          id: "order-1",
          orderNumber: "ORD-1",
          status: OrderStatus.PENDING,
          shop: {
            id: "shop-1",
            name: "Demo Shop",
            slug: "demo-shop"
          }
        },
        events: [
          {
            id: "event-1",
            eventType: "PAYMENT_CREATED",
            source: "checkout",
            actorType: "CHECKOUT",
            actorUser: null,
            previousStatus: null,
            nextStatus: PaymentStatus.PENDING,
            payload: null,
            createdAt: new Date("2026-04-20T10:00:00.000Z")
          }
        ]
      }
    ]);
    prisma.payment.count.mockResolvedValue(1);

    const result = await service.listAdmin({
      page: 1,
      pageSize: 12,
      status: PaymentStatus.PENDING
    });

    expect(result.pagination.total).toBe(1);
    expect(result.items[0]).toEqual({
      id: "payment-list-1",
      method: PaymentMethod.ONLINE_GATEWAY,
      status: PaymentStatus.PENDING,
      amount: "722000",
      referenceCode: "PAY-LIST-1",
      expiresAt: "2026-04-20T10:15:00.000Z",
      paidAt: null,
      createdAt: "2026-04-20T10:00:00.000Z",
      updatedAt: "2026-04-20T10:00:00.000Z",
      user: {
        id: "user-1",
        fullName: "Demo Buyer",
        email: "buyer@ecoms.local"
      },
      order: {
        id: "order-1",
        orderNumber: "ORD-1",
        status: OrderStatus.PENDING,
        shop: {
          id: "shop-1",
          name: "Demo Shop",
          slug: "demo-shop"
        }
      },
      recentEvents: [
        {
          id: "event-1",
          eventType: "PAYMENT_CREATED",
          source: "checkout",
          actorType: "CHECKOUT",
          actorUser: null,
          previousStatus: null,
          nextStatus: PaymentStatus.PENDING,
          payload: null,
          createdAt: "2026-04-20T10:00:00.000Z"
        }
      ]
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
