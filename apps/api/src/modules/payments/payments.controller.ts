import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthPayload } from "../auth/types/auth-payload";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { AdminBatchReplayMockWebhookDto } from "./dto/admin-batch-replay-mock-webhook.dto";
import { AdminReplayMockWebhookDto } from "./dto/admin-replay-mock-webhook.dto";
import { ListAdminPaymentsDto } from "./dto/list-admin-payments.dto";
import { MockPaymentWebhookDto } from "./dto/mock-payment-webhook.dto";
import { PaymentTraceQueryDto } from "./dto/payment-trace-query.dto";
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

  @Post("admin/replay-mock-webhook/batch")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  replayMockWebhookBatch(
    @CurrentUser() actor: AuthPayload,
    @Body() payload: AdminBatchReplayMockWebhookDto
  ) {
    return this.paymentsService.batchReplayMockWebhook(actor, payload);
  }

  @Get("admin/trace")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAdminTrace(@Query() query: PaymentTraceQueryDto) {
    return this.paymentsService.getAdminTrace(query);
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listAdmin(@Query() query: ListAdminPaymentsDto) {
    return this.paymentsService.listAdmin(query);
  }

  @Get("admin/incidents")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAdminIncidentCenter() {
    return this.paymentsService.getAdminIncidentCenter();
  }
}
