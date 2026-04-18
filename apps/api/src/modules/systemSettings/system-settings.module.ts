import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditLogsModule } from "../auditLogs/audit-logs.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemSettingsController } from "./system-settings.controller";
import { SystemSettingsService } from "./system-settings.service";

@Module({
  imports: [AuthModule, PrismaModule, AuditLogsModule],
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService],
  exports: [SystemSettingsService]
})
export class SystemSettingsModule {}
