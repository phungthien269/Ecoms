import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentMethod, PaymentWebhookEvent } from "@ecoms/contracts";
import { createHmac } from "node:crypto";

@Injectable()
export class PaymentGatewayService {
  constructor(private readonly configService: ConfigService) {}

  createPendingPaymentMetadata(input: {
    paymentMethod: PaymentMethod;
    referenceCode: string;
    orderId: string;
    orderNumber: string;
    amount: string;
    expiresAt: Date;
  }) {
    const provider = this.configService.get<string>("PAYMENT_PROVIDER", "mock_gateway");
    const frontendUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");
    const callbackUrl = `${frontendUrl.replace(/\/+$/, "")}/orders/${input.orderId}`;

    if (input.paymentMethod === PaymentMethod.BANK_TRANSFER) {
      return {
        flow: "mock_pending_payment",
        provider,
        checkoutMode: "bank_transfer",
        paymentUrl: `${frontendUrl.replace(/\/+$/, "")}/orders/${input.orderId}?pay=${input.referenceCode}`,
        callbackUrl,
        qrPayload: `BANK|${input.referenceCode}|${input.amount}|${input.orderNumber}`,
        bankAccountName: "ECOMS MARKETPLACE",
        bankAccountNumber: "000111222333",
        bankName: "Mock Commerce Bank"
      };
    }

    if (input.paymentMethod === PaymentMethod.ONLINE_GATEWAY) {
      return {
        flow: "mock_pending_payment",
        provider,
        checkoutMode: "hosted_checkout",
        paymentUrl: `${frontendUrl.replace(/\/+$/, "")}/orders/${input.orderId}?gateway=${input.referenceCode}`,
        callbackUrl,
        sessionToken: this.signGatewayToken(input.referenceCode, input.expiresAt.toISOString())
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
    const webhookPayload = {
      paymentId: `payment-${paymentMethod.toLowerCase()}`,
      referenceCode,
      event: PaymentWebhookEvent.PAID,
      providerReference: `gateway-${referenceCode.toLowerCase()}`,
      occurredAt
    };

    return {
      provider: this.configService.get<string>("PAYMENT_PROVIDER", "mock_gateway"),
      paymentMethod,
      referenceCode,
      expiresAt: expiresAt.toISOString(),
      metadata,
      webhookPayload,
      webhookSignature: this.signWebhookPayload(webhookPayload)
    };
  }

  private signGatewayToken(referenceCode: string, expiresAt: string) {
    return createHmac("sha256", this.getWebhookSecret())
      .update(`${referenceCode}|${expiresAt}`)
      .digest("hex");
  }

  private getWebhookSecret() {
    return this.configService.get<string>("PAYMENT_WEBHOOK_SECRET", "change_me_payment_webhook");
  }
}
