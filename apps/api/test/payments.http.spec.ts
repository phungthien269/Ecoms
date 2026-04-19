import type { INestApplication } from "@nestjs/common";
import { PaymentWebhookEvent } from "@ecoms/contracts";
import { createHmac } from "node:crypto";
import request from "supertest";
import { PaymentsController } from "../src/modules/payments/payments.controller";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { createHttpTestApp } from "./support/create-http-test-app";

describe("PaymentsController (http)", () => {
  let app: INestApplication;
  const paymentsService = {
    confirm: jest.fn(),
    handleMockWebhook: jest.fn(),
    expireStalePendingPayments: jest.fn(),
    replayMockWebhook: jest.fn(),
    getAdminTrace: jest.fn()
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
