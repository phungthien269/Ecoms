import { Controller, Get, UseGuards } from "@nestjs/common";
import type { HealthStatus, ReadinessStatus } from "@ecoms/contracts";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UserRole } from "@ecoms/contracts";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
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
}
