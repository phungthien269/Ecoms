import { ConfigService } from "@nestjs/config";
import { PaymentMethod, PaymentWebhookEvent } from "@ecoms/contracts";
import { PaymentGatewayService } from "../src/modules/payments/payment-gateway.service";

describe("PaymentGatewayService", () => {
  const configService = {
    get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
      const mapping: Record<string, unknown> = {
        PAYMENT_PROVIDER: "mock_gateway",
        FRONTEND_URL: "http://localhost:3000",
        PAYMENT_WEBHOOK_SECRET: "test-payment-secret"
      };

      return mapping[key] ?? fallback;
    })
  } satisfies Partial<ConfigService>;

  const service = new PaymentGatewayService(configService as never);

  it("builds hosted checkout metadata for online gateway payments", () => {
    const result = service.createPendingPaymentMetadata({
      paymentMethod: PaymentMethod.ONLINE_GATEWAY,
      referenceCode: "PAY-ABC",
      orderId: "order-1",
      orderNumber: "ORD-1",
      amount: "722000",
      expiresAt: new Date("2026-04-19T02:00:00.000Z")
    });

    expect(result).toEqual(
      expect.objectContaining({
        provider: "mock_gateway",
        checkoutMode: "hosted_checkout",
        paymentUrl: "http://localhost:3000/orders/order-1?gateway=PAY-ABC",
        callbackUrl: "http://localhost:3000/orders/order-1",
        sessionToken: expect.any(String)
      })
    );
  });

  it("builds bank transfer metadata with qr payload", () => {
    const result = service.createPendingPaymentMetadata({
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      referenceCode: "PAY-BANK",
      orderId: "order-2",
      orderNumber: "ORD-2",
      amount: "578200",
      expiresAt: new Date("2026-04-19T02:00:00.000Z")
    });

    expect(result).toEqual(
      expect.objectContaining({
        provider: "mock_gateway",
        checkoutMode: "bank_transfer",
        qrPayload: "BANK|PAY-BANK|578200|ORD-2",
        bankAccountName: "ECOMS MARKETPLACE"
      })
    );
  });

  it("signs webhook payloads deterministically", () => {
    const first = service.signWebhookPayload({
      paymentId: "payment-1",
      event: PaymentWebhookEvent.PAID,
      providerReference: "gateway-1",
      occurredAt: "2026-04-19T00:00:00.000Z"
    });
    const second = service.signWebhookPayload({
      paymentId: "payment-1",
      event: PaymentWebhookEvent.PAID,
      providerReference: "gateway-1",
      occurredAt: "2026-04-19T00:00:00.000Z"
    });

    expect(first).toBe(second);
  });
});
