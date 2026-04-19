import type { INestApplication } from "@nestjs/common";
import { PaymentWebhookEvent } from "@ecoms/contracts";
import { createHmac } from "node:crypto";
import request from "supertest";
import { PaymentsController } from "../src/modules/payments/payments.controller";
import { DemoGatewayWebhookStatus } from "../src/modules/payments/dto/demo-gateway-webhook.dto";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { createHttpTestApp } from "./support/create-http-test-app";

describe("PaymentsController (http)", () => {
  let app: INestApplication;
  const paymentsService = {
    confirm: jest.fn(),
    handleMockWebhook: jest.fn(),
    handleDemoGatewayWebhook: jest.fn(),
    expireStalePendingPayments: jest.fn(),
    replayMockWebhook: jest.fn(),
    batchReplayMockWebhook: jest.fn(),
    getAdminTrace: jest.fn(),
    listAdmin: jest.fn(),
    getAdminIncidentCenter: jest.fn()
  } satisfies Partial<PaymentsService>;

  beforeAll(async () => {
    app = await createHttpTestApp({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: paymentsService
        }
      ],
      configValues: {
        PAYMENT_WEBHOOK_SECRET: "test-payment-secret"
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts public mock webhook with valid signature", async () => {
    const payload = {
      paymentId: "payment-1",
      event: PaymentWebhookEvent.PAID,
      providerReference: "gateway-1",
      occurredAt: "2026-04-18T00:00:00.000Z"
    };
    const signature = signWebhookPayload(payload, "test-payment-secret");
    paymentsService.handleMockWebhook.mockResolvedValue({
      paymentId: "payment-1",
      orderId: "order-1",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
      processed: true
    });

    const response = await request(app.getHttpServer())
      .post("/api/payments/webhooks/mock")
      .set("x-request-id", "req-payment-webhook")
      .set("x-ecoms-webhook-signature", signature)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.requestId).toBe("req-payment-webhook");
    expect(paymentsService.handleMockWebhook).toHaveBeenCalledWith(payload, signature);
  });

  it("accepts public demo gateway webhook with valid signature", async () => {
    const payload = {
      merchantCode: "merchant_001",
      referenceCode: "PAY-DEMO-1",
      status: DemoGatewayWebhookStatus.SUCCESS,
      providerReference: "demo-ref-1",
      occurredAt: "2026-04-20T10:00:00.000Z"
    };
    const signature = signDemoGatewayPayload(payload, "test-payment-secret");
    paymentsService.handleDemoGatewayWebhook.mockResolvedValue({
      paymentId: "payment-demo-1",
      orderId: "order-demo-1",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
      processed: true
    });

    const response = await request(app.getHttpServer())
      .post("/api/payments/webhooks/demo")
      .set("x-request-id", "req-demo-webhook")
      .set("x-demo-gateway-signature", signature)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.requestId).toBe("req-demo-webhook");
    expect(paymentsService.handleDemoGatewayWebhook).toHaveBeenCalledWith(payload, signature);
  });

  it("keeps manual confirm behind auth guard", async () => {
    const response = await request(app.getHttpServer()).post("/api/payments/payment-1/confirm");

    expect(response.status).toBe(401);
    expect(paymentsService.confirm).not.toHaveBeenCalled();
  });

  it("lets admins trigger stale payment expiry sweep", async () => {
    paymentsService.expireStalePendingPayments.mockResolvedValue({
      expiredCount: 3,
      cancelledOrderCount: 2
    });

    const response = await request(app.getHttpServer())
      .post("/api/payments/admin/expire-stale")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", "ADMIN");

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      expiredCount: 3,
      cancelledOrderCount: 2
    });
    expect(paymentsService.expireStalePendingPayments).toHaveBeenCalledWith();
  });

  it("lets admins replay a mock payment callback", async () => {
    const payload = {
      referenceCode: "PAY-ORDER-7",
      event: PaymentWebhookEvent.FAILED,
      providerReference: "provider-7"
    };
    paymentsService.replayMockWebhook.mockResolvedValue({
      paymentId: "payment-7",
      orderId: "order-7",
      paymentStatus: "FAILED",
      orderStatus: "CANCELLED",
      processed: true
    });

    const response = await request(app.getHttpServer())
      .post("/api/payments/admin/replay-mock-webhook")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", "ADMIN")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      paymentId: "payment-7",
      orderId: "order-7",
      paymentStatus: "FAILED",
      orderStatus: "CANCELLED",
      processed: true
    });
    expect(paymentsService.replayMockWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "admin-1",
        role: "ADMIN"
      }),
      payload
    );
  });

  it("lets admins batch replay mock payment callbacks", async () => {
    const payload = {
      paymentIds: ["payment-1", "payment-2"],
      event: PaymentWebhookEvent.EXPIRED,
      providerReferencePrefix: "incident-expire"
    };
    paymentsService.batchReplayMockWebhook.mockResolvedValue({
      event: PaymentWebhookEvent.EXPIRED,
      targetCount: 2,
      successCount: 2,
      failureCount: 0,
      results: []
    });

    const response = await request(app.getHttpServer())
      .post("/api/payments/admin/replay-mock-webhook/batch")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", "ADMIN")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(paymentsService.batchReplayMockWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "admin-1",
        role: "ADMIN"
      }),
      payload
    );
  });

  it("lets admins fetch payment trace by reference code", async () => {
    paymentsService.getAdminTrace.mockResolvedValue({
      payment: {
        id: "payment-9",
        orderId: "order-9",
        orderNumber: "ORD-9",
        orderStatus: "CONFIRMED",
        method: "ONLINE_GATEWAY",
        status: "PAID",
        amount: "722000",
        referenceCode: "PAY-9",
        expiresAt: null,
        paidAt: "2026-04-20T10:05:00.000Z",
        metadata: null,
        createdAt: "2026-04-20T10:00:00.000Z",
        updatedAt: "2026-04-20T10:05:00.000Z"
      },
      events: []
    });

    const response = await request(app.getHttpServer())
      .get("/api/payments/admin/trace?referenceCode=PAY-9")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(paymentsService.getAdminTrace).toHaveBeenCalledWith({
      referenceCode: "PAY-9"
    });
  });

  it("lets admins list payments backlog", async () => {
    paymentsService.listAdmin.mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        pageSize: 12,
        total: 0,
        totalPages: 1
      }
    });

    const response = await request(app.getHttpServer())
      .get("/api/payments/admin?status=PENDING&paymentMethod=ONLINE_GATEWAY&eventType=PAYMENT_CREATED")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(paymentsService.listAdmin).toHaveBeenCalledWith({
      status: "PENDING",
      paymentMethod: "ONLINE_GATEWAY",
      eventType: "PAYMENT_CREATED",
      page: 1,
      pageSize: 12
    });
  });

  it("lets admins load payment incident center", async () => {
    paymentsService.getAdminIncidentCenter.mockResolvedValue({
      gateway: {
        enabled: false,
        incidentMessage: "Gateway paused",
        provider: "mock_gateway",
        displayName: "Mock Gateway",
        mode: "mock_gateway",
        configured: true,
        actionHint: "Open settings to resume gateway."
      },
      impact: {
        pendingCount: 2,
        recentFailedOrExpiredCount: 3,
        oldestPendingAt: "2026-04-20T11:00:00.000Z",
        nextPendingExpiryAt: "2026-04-20T11:15:00.000Z",
        pendingAgeBuckets: {
          underFiveMinutes: 0,
          fiveToFifteenMinutes: 1,
          overFifteenMinutes: 1
        },
        recentFailureBreakdown: {
          failed: 2,
          expired: 1
        },
        affectedShops: [],
        affectedCustomers: []
      },
      pendingPayments: [],
      recentFailures: [],
      activity: []
    });

    const response = await request(app.getHttpServer())
      .get("/api/payments/admin/incidents")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(paymentsService.getAdminIncidentCenter).toHaveBeenCalledWith();
  });
});

function signWebhookPayload(
  payload: {
    paymentId?: string;
    referenceCode?: string;
    event: PaymentWebhookEvent;
    providerReference?: string;
    occurredAt?: string;
  },
  secret: string
) {
  const normalized = [
    payload.paymentId ?? "",
    payload.referenceCode ?? "",
    payload.event,
    payload.providerReference ?? "",
    payload.occurredAt ?? ""
  ].join("|");

  return createHmac("sha256", secret).update(normalized).digest("hex");
}

function signDemoGatewayPayload(
  payload: {
    merchantCode: string;
    referenceCode: string;
    status: DemoGatewayWebhookStatus;
    providerReference: string;
    occurredAt: string;
  },
  secret: string
) {
  const normalized = [
    payload.merchantCode,
    payload.referenceCode,
    payload.status,
    payload.providerReference,
    payload.occurredAt
  ].join("|");

  return createHmac("sha256", secret).update(normalized).digest("hex");
}
