import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../auditLogs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { SystemSettingsModule } from "../systemSettings/system-settings.module";
import { ShopsController } from "./shops.controller";
import { ShopsService } from "./shops.service";

@Module({
  imports: [AuthModule, AuditLogsModule, SystemSettingsModule],
  controllers: [ShopsController],
  providers: [ShopsService],
  exports: [ShopsService]
})
export class ShopsModule {}
