import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RateLimit } from "../rateLimit/rate-limit.decorator";
import { RateLimitGuard } from "../rateLimit/rate-limit.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { CreateReportDto } from "./dto/create-report.dto";
import { UpdateReportStatusDto } from "./dto/update-report-status.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({
    name: "reports.create"
  })
  create(@CurrentUser("sub") userId: string, @Body() payload: CreateReportDto) {
    return this.reportsService.create(userId, payload);
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listAdmin() {
    return this.reportsService.listAdmin();
  }

  @Patch("admin/:reportId/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateStatus(
    @CurrentUser("sub") userId: string,
    @Param("reportId") reportId: string,
    @Body() payload: UpdateReportStatusDto
  ) {
    return this.reportsService.updateStatus(userId, reportId, payload);
  }
}
