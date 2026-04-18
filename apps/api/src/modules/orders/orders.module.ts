import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../auditLogs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { MailerModule } from "../mailer/mailer.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrderStatusHistoryModule } from "../orderStatusHistory/order-status-history.module";
import { PaymentsModule } from "../payments/payments.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemSettingsModule } from "../systemSettings/system-settings.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [
    AuthModule,
    AuditLogsModule,
    PrismaModule,
    NotificationsModule,
    PaymentsModule,
    MailerModule,
    OrderStatusHistoryModule,
    SystemSettingsModule
  ],
  controllers: [OrdersController],
  providers: [OrdersService]
})
export class OrdersModule {}
