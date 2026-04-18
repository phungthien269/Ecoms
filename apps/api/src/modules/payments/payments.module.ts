import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrderStatusHistoryModule } from "../orderStatusHistory/order-status-history.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemSettingsModule } from "../systemSettings/system-settings.module";
import { PaymentExpirySchedulerService } from "./payment-expiry-scheduler.service";
import { PaymentsController } from "./payments.controller";
import { PaymentLifecycleService } from "./payment-lifecycle.service";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    PrismaModule,
    NotificationsModule,
    OrderStatusHistoryModule,
    SystemSettingsModule
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentLifecycleService, PaymentExpirySchedulerService],
  exports: [PaymentLifecycleService, PaymentExpirySchedulerService]
})
export class PaymentsModule {}
