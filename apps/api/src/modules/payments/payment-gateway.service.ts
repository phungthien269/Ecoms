import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentMethod, PaymentWebhookEvent } from "@ecoms/contracts";
import { createHmac } from "node:crypto";
import {
  DemoGatewayWebhookDto,
  DemoGatewayWebhookStatus
} from "./dto/demo-gateway-webhook.dto";

@Injectable()
export class PaymentGatewayService {
  constructor(private readonly configService: ConfigService) {}

  getProviderDiagnostics() {
    const provider = this.getProviderMode();
    const baseUrl = this.configService.get<string>("PAYMENT_PROVIDER_BASE_URL") ?? null;
    const merchantCode = this.configService.get<string>("PAYMENT_PROVIDER_MERCHANT_CODE") ?? null;
    const displayName = this.configService.get<string>(
      "PAYMENT_PROVIDER_DISPLAY_NAME",
      provider === "demo_gateway" ? "Demo Gateway" : "Mock Gateway"
    );
    const configured = provider === "mock_gateway" || Boolean(baseUrl && merchantCode);

    return {
      provider,
      displayName,
      mode: provider,
      configured,
      webhookMode: provider === "demo_gateway" ? "provider_callback" : "internal_mock",
      supportsHostedCheckout: true,
      supportsBankTransfer: true,
      supportsWebhookReplay: provider === "mock_gateway",
      callbackPath: provider === "demo_gateway" ? "/api/payments/webhooks/demo" : "/api/payments/webhooks/mock",
      signatureHeaderName:
        provider === "demo_gateway"
          ? "x-demo-gateway-signature"
          : "x-ecoms-webhook-signature",
      merchantCode,
      baseUrl,
      actionHint: configured
        ? provider === "demo_gateway"
          ? "Validate callback URL, merchant code, and shared webhook secret against the external demo gateway."
          : "Switch to demo_gateway when you want provider-shaped checkout and callback behavior."
        : "Set PAYMENT_PROVIDER_BASE_URL and PAYMENT_PROVIDER_MERCHANT_CODE before using demo_gateway."
    } as const;
  }

  createPendingPaymentMetadata(input: {
    paymentMethod: PaymentMethod;
    referenceCode: string;
    orderId: string;
    orderNumber: string;
    amount: string;
    expiresAt: Date;
  }) {
    const provider = this.getProviderMode();
    const frontendUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");
    const callbackUrl = `${frontendUrl.replace(/\/+$/, "")}/orders/${input.orderId}`;
    const providerBaseUrl = this.configService.get<string>("PAYMENT_PROVIDER_BASE_URL", frontendUrl);
    const merchantCode = this.configService.get<string>("PAYMENT_PROVIDER_MERCHANT_CODE", "demo_merchant");
    const displayName = this.configService.get<string>(
      "PAYMENT_PROVIDER_DISPLAY_NAME",
      provider === "demo_gateway" ? "Demo Gateway" : "Mock Gateway"
    );
    const bankAccountName = this.configService.get<string>(
      "PAYMENT_BANK_ACCOUNT_NAME",
      "ECOMS MARKETPLACE"
    );
    const bankAccountNumber = this.configService.get<string>(
      "PAYMENT_BANK_ACCOUNT_NUMBER",
      "000111222333"
    );
    const bankName = this.configService.get<string>("PAYMENT_BANK_NAME", "Mock Commerce Bank");

    if (input.paymentMethod === PaymentMethod.BANK_TRANSFER) {
      return {
        flow: provider === "demo_gateway" ? "provider_bank_transfer" : "mock_pending_payment",
        provider,
        providerDisplayName: displayName,
        checkoutMode: "bank_transfer",
        paymentUrl:
          provider === "demo_gateway"
            ? `${providerBaseUrl.replace(/\/+$/, "")}/bank-transfer/${input.referenceCode}?merchant=${merchantCode}`
            : `${frontendUrl.replace(/\/+$/, "")}/orders/${input.orderId}?pay=${input.referenceCode}`,
        callbackUrl,
        qrPayload: `BANK|${input.referenceCode}|${input.amount}|${input.orderNumber}`,
        bankAccountName,
        bankAccountNumber,
        bankName,
        merchantCode
      };
    }

    if (input.paymentMethod === PaymentMethod.ONLINE_GATEWAY) {
      return {
        flow: provider === "demo_gateway" ? "provider_pending_payment" : "mock_pending_payment",
        provider,
        providerDisplayName: displayName,
        checkoutMode: "hosted_checkout",
        paymentUrl:
          provider === "demo_gateway"
            ? `${providerBaseUrl.replace(/\/+$/, "")}/checkout/${input.referenceCode}?merchant=${merchantCode}`
            : `${frontendUrl.replace(/\/+$/, "")}/orders/${input.orderId}?gateway=${input.referenceCode}`,
        callbackUrl,
        sessionToken: this.signGatewayToken(input.referenceCode, input.expiresAt.toISOString()),
        merchantCode
      };
    }

    return {
      flow: "cash_on_delivery",
      provider: "internal"
    };
  }

  signWebhookPayload(payload: {
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

    return createHmac("sha256", this.getWebhookSecret()).update(normalized).digest("hex");
  }

  signDemoGatewayPayload(payload: DemoGatewayWebhookDto) {
    const normalized = [
      payload.merchantCode,
      payload.referenceCode,
      payload.status,
      payload.providerReference,
      payload.occurredAt
    ].join("|");

    return createHmac("sha256", this.getWebhookSecret()).update(normalized).digest("hex");
  }

  mapDemoGatewayStatus(status: DemoGatewayWebhookStatus) {
    switch (status) {
      case DemoGatewayWebhookStatus.SUCCESS:
        return PaymentWebhookEvent.PAID;
      case DemoGatewayWebhookStatus.FAILED:
        return PaymentWebhookEvent.FAILED;
      case DemoGatewayWebhookStatus.EXPIRED:
        return PaymentWebhookEvent.EXPIRED;
      default:
        return PaymentWebhookEvent.FAILED;
    }
  }

  createDiagnosticGatewaySample(input?: {
    paymentMethod?: PaymentMethod;
    orderId?: string;
    orderNumber?: string;
    amount?: string;
  }) {
    const paymentMethod = input?.paymentMethod ?? PaymentMethod.ONLINE_GATEWAY;
    const orderId = input?.orderId ?? "diagnostic-order";
    const orderNumber = input?.orderNumber ?? "ORD-DIAGNOSTIC";
    const amount = input?.amount ?? "199000";
    const referenceCode = `PAY-DIAG-${paymentMethod === PaymentMethod.BANK_TRANSFER ? "BANK" : "HOST"}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const occurredAt = new Date().toISOString();
    const metadata = this.createPendingPaymentMetadata({
      paymentMethod,
      referenceCode,
      orderId,
      orderNumber,
      amount,
      expiresAt
    });
    const providerDiagnostics = this.getProviderDiagnostics();
    const webhookPayload = {
      paymentId: `payment-${paymentMethod.toLowerCase()}`,
      referenceCode,
      event: PaymentWebhookEvent.PAID,
      providerReference: `gateway-${referenceCode.toLowerCase()}`,
      occurredAt
    };
    const providerWebhookPayload: DemoGatewayWebhookDto | typeof webhookPayload =
      providerDiagnostics.mode === "demo_gateway"
        ? {
            merchantCode: providerDiagnostics.merchantCode ?? "demo_merchant",
            referenceCode,
            status: DemoGatewayWebhookStatus.SUCCESS,
            providerReference: `gateway-${referenceCode.toLowerCase()}`,
            occurredAt
          }
        : webhookPayload;

    return {
      provider: this.getProviderMode(),
      providerDiagnostics,
      paymentMethod,
      referenceCode,
      expiresAt: expiresAt.toISOString(),
      metadata,
      webhookPayload: providerWebhookPayload,
      webhookSignature:
        providerDiagnostics.mode === "demo_gateway"
          ? this.signDemoGatewayPayload(providerWebhookPayload as DemoGatewayWebhookDto)
          : this.signWebhookPayload(webhookPayload)
    };
  }

  parseCheckoutArtifact(metadata: unknown) {
    if (!metadata || typeof metadata !== "object") {
      return null;
    }

    const value = metadata as Record<string, unknown>;
    if (
      (value.checkoutMode !== "hosted_checkout" && value.checkoutMode !== "bank_transfer") ||
      typeof value.provider !== "string"
    ) {
      return null;
    }

    return {
      provider: value.provider,
      providerDisplayName:
        typeof value.providerDisplayName === "string" ? value.providerDisplayName : null,
      checkoutMode: value.checkoutMode,
      paymentUrl: typeof value.paymentUrl === "string" ? value.paymentUrl : null,
      callbackUrl: typeof value.callbackUrl === "string" ? value.callbackUrl : null,
      sessionToken: typeof value.sessionToken === "string" ? value.sessionToken : null,
      qrPayload: typeof value.qrPayload === "string" ? value.qrPayload : null,
      merchantCode: typeof value.merchantCode === "string" ? value.merchantCode : null,
      bankAccountName: typeof value.bankAccountName === "string" ? value.bankAccountName : null,
      bankAccountNumber:
        typeof value.bankAccountNumber === "string" ? value.bankAccountNumber : null,
      bankName: typeof value.bankName === "string" ? value.bankName : null
    } as const;
  }

  private signGatewayToken(referenceCode: string, expiresAt: string) {
    return createHmac("sha256", this.getWebhookSecret())
      .update(`${referenceCode}|${expiresAt}`)
      .digest("hex");
  }

  private getWebhookSecret() {
    return this.configService.get<string>("PAYMENT_WEBHOOK_SECRET", "change_me_payment_webhook");
  }

  private getProviderMode() {
    return this.configService.get<"mock_gateway" | "demo_gateway">(
      "PAYMENT_PROVIDER",
      "mock_gateway"
    );
  }
}
