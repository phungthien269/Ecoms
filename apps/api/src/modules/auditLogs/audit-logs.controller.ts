import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { ListAuditLogsDto } from "./dto/list-audit-logs.dto";
import { AuditLogsService } from "./audit-logs.service";

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get("admin")
  listAdmin(@Query() query: ListAuditLogsDto) {
    return this.auditLogsService.listAdmin(query);
  }
}
