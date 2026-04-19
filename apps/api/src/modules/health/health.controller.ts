import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import type { HealthStatus, ReadinessStatus } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PaymentMethod, UserRole } from "@ecoms/contracts";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import type { AuthPayload } from "../auth/types/auth-payload";
import { SendTestEmailDto } from "./dto/send-test-email.dto";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthStatus {
    return this.healthService.getHealth();
  }

  @Get("ready")
  async getReadiness(): Promise<ReadinessStatus> {
    return this.healthService.assertReady();
  }

  @Get("diagnostics")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getDiagnostics(): Promise<ReadinessStatus> {
    return this.healthService.getDiagnostics();
  }

  @Get("diagnostics/history")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getDiagnosticsHistory() {
    return this.healthService.getDiagnosticsActivity();
  }

  @Post("diagnostics/test-email")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async sendTestEmail(
    @Body() payload: SendTestEmailDto,
    @CurrentUser() user: AuthPayload
  ) {
    return this.healthService.sendTestEmail(
      user,
      payload.recipientEmail,
      payload.subject || `Diagnostics test from ${user.email}`
    );
  }

  @Get("diagnostics/media-upload-sample")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getMediaUploadSample(@CurrentUser() user: AuthPayload) {
    return this.healthService.getMediaUploadSample(user);
  }

  @Get("diagnostics/payment-gateway-sample")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getPaymentGatewaySample(
    @CurrentUser() user: AuthPayload,
    @Query("paymentMethod") paymentMethod?: string
  ) {
    const normalizedMethod =
      paymentMethod === PaymentMethod.BANK_TRANSFER
        ? PaymentMethod.BANK_TRANSFER
        : paymentMethod === PaymentMethod.ONLINE_GATEWAY
          ? PaymentMethod.ONLINE_GATEWAY
          : undefined;
    return this.healthService.getPaymentGatewaySample(user, normalizedMethod);
  }

  @Get("diagnostics/payment-provider")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getPaymentProviderDiagnostics(@CurrentUser() user: AuthPayload) {
    return this.healthService.getPaymentProviderDiagnostics(user);
  }
}
