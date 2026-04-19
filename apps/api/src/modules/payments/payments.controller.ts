import { Body, Controller, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthPayload } from "../auth/types/auth-payload";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { AdminReplayMockWebhookDto } from "./dto/admin-replay-mock-webhook.dto";
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

  @Post("admin/expire-stale")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  expireStalePendingPayments() {
    return this.paymentsService.expireStalePendingPayments();
  }

  @Post("admin/replay-mock-webhook")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  replayMockWebhook(
    @CurrentUser() actor: AuthPayload,
    @Body() payload: AdminReplayMockWebhookDto
  ) {
    return this.paymentsService.replayMockWebhook(actor, payload);
  }
}
