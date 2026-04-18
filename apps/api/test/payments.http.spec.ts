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
    expireStalePendingPayments: jest.fn()
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
