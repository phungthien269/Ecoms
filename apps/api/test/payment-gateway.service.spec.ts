import { ConfigService } from "@nestjs/config";
import { PaymentMethod, PaymentWebhookEvent } from "@ecoms/contracts";
import { PaymentGatewayService } from "../src/modules/payments/payment-gateway.service";
import { DemoGatewayWebhookStatus } from "../src/modules/payments/dto/demo-gateway-webhook.dto";

describe("PaymentGatewayService", () => {
  const configService = {
    get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
      const mapping: Record<string, unknown> = {
        PAYMENT_PROVIDER: "mock_gateway",
        FRONTEND_URL: "http://localhost:3000",
        PAYMENT_WEBHOOK_SECRET: "test-payment-secret",
        PAYMENT_PROVIDER_DISPLAY_NAME: "Mock Gateway",
        PAYMENT_PROVIDER_BASE_URL: "http://localhost:4010",
        PAYMENT_PROVIDER_MERCHANT_CODE: "demo_merchant",
        PAYMENT_BANK_ACCOUNT_NAME: "ECOMS MARKETPLACE",
        PAYMENT_BANK_ACCOUNT_NUMBER: "000111222333",
        PAYMENT_BANK_NAME: "Mock Commerce Bank"
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

  it("returns payment provider diagnostics for mock gateway", () => {
    const result = service.getProviderDiagnostics();

    expect(result).toEqual(
      expect.objectContaining({
        provider: "mock_gateway",
        mode: "mock_gateway",
        configured: true,
        supportsWebhookReplay: true,
        callbackPath: "/api/payments/webhooks/mock",
        signatureHeaderName: "x-ecoms-webhook-signature"
      })
    );
  });

  it("builds provider-shaped metadata for demo gateway mode", () => {
    configService.get.mockImplementation((key: string, fallback?: unknown) => {
      const mapping: Record<string, unknown> = {
        PAYMENT_PROVIDER: "demo_gateway",
        FRONTEND_URL: "http://localhost:3000",
        PAYMENT_WEBHOOK_SECRET: "test-payment-secret",
        PAYMENT_PROVIDER_DISPLAY_NAME: "Demo Gateway",
        PAYMENT_PROVIDER_BASE_URL: "http://localhost:4010",
        PAYMENT_PROVIDER_MERCHANT_CODE: "merchant_001",
        PAYMENT_BANK_ACCOUNT_NAME: "ECOMS MARKETPLACE",
        PAYMENT_BANK_ACCOUNT_NUMBER: "000111222333",
        PAYMENT_BANK_NAME: "Mock Commerce Bank"
      };

      return mapping[key] ?? fallback;
    });

    const result = service.createPendingPaymentMetadata({
      paymentMethod: PaymentMethod.ONLINE_GATEWAY,
      referenceCode: "PAY-DEMO",
      orderId: "order-demo",
      orderNumber: "ORD-DEMO",
      amount: "722000",
      expiresAt: new Date("2026-04-19T02:00:00.000Z")
    });

    expect(result).toEqual(
      expect.objectContaining({
        provider: "demo_gateway",
        providerDisplayName: "Demo Gateway",
        merchantCode: "merchant_001",
        paymentUrl: "http://localhost:4010/checkout/PAY-DEMO?merchant=merchant_001"
      })
    );
  });

  it("parses checkout artifact from payment metadata", () => {
    const result = service.parseCheckoutArtifact({
      provider: "demo_gateway",
      providerDisplayName: "Demo Gateway",
      checkoutMode: "hosted_checkout",
      paymentUrl: "http://localhost:4010/checkout/PAY-DEMO?merchant=merchant_001",
      callbackUrl: "http://localhost:3000/orders/order-demo",
      sessionToken: "session-token"
    });

    expect(result).toEqual({
      provider: "demo_gateway",
      providerDisplayName: "Demo Gateway",
      checkoutMode: "hosted_checkout",
      paymentUrl: "http://localhost:4010/checkout/PAY-DEMO?merchant=merchant_001",
      callbackUrl: "http://localhost:3000/orders/order-demo",
      sessionToken: "session-token",
      qrPayload: null,
      merchantCode: null,
      bankAccountName: null,
      bankAccountNumber: null,
      bankName: null
    });
  });

  it("signs demo gateway payloads deterministically", () => {
    configService.get.mockImplementation((key: string, fallback?: unknown) => {
      const mapping: Record<string, unknown> = {
        PAYMENT_PROVIDER: "demo_gateway",
        PAYMENT_WEBHOOK_SECRET: "test-payment-secret"
      };

      return mapping[key] ?? fallback;
    });

    const first = service.signDemoGatewayPayload({
      merchantCode: "merchant_001",
      referenceCode: "PAY-DEMO",
      status: DemoGatewayWebhookStatus.SUCCESS,
      providerReference: "demo-ref-1",
      occurredAt: "2026-04-20T10:00:00.000Z"
    });
    const second = service.signDemoGatewayPayload({
      merchantCode: "merchant_001",
      referenceCode: "PAY-DEMO",
      status: DemoGatewayWebhookStatus.SUCCESS,
      providerReference: "demo-ref-1",
      occurredAt: "2026-04-20T10:00:00.000Z"
    });

    expect(first).toBe(second);
  });
});
