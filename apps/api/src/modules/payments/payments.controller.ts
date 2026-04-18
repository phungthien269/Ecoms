import { Body, Controller, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { MockPaymentWebhookDto } from "./dto/mock-payment-webhook.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(":paymentId/confirm")
  @UseGuards(JwtAuthGuard)
  confirm(@CurrentUser("sub") userId: string, @Param("paymentId") paymentId: string) {
    return this.paymentsService.confirm(userId, paymentId);
  }

  @Post("webhooks/mock")
  handleMockWebhook(
    @Body() payload: MockPaymentWebhookDto,
    @Headers("x-ecoms-webhook-signature") signature: string | undefined
  ) {
    return this.paymentsService.handleMockWebhook(payload, signature);
  }
}
