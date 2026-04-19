import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../auditLogs/audit-logs.module";
import { FilesModule } from "../files/files.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { MailerModule } from "../mailer/mailer.module";
import { PaymentsModule } from "../payments/payments.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RateLimitModule } from "../rateLimit/rate-limit.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { SystemSettingsModule } from "../systemSettings/system-settings.module";

@Module({
  imports: [
    PrismaModule,
    AuditLogsModule,
    MailerModule,
    FilesModule,
    RateLimitModule,
    RealtimeModule,
    PaymentsModule,
    SystemSettingsModule
  ],
  controllers: [HealthController],
  providers: [HealthService]
})
export class HealthModule {}
