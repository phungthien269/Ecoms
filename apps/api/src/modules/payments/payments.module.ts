import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrderStatusHistoryModule } from "../orderStatusHistory/order-status-history.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemSettingsModule } from "../systemSettings/system-settings.module";
import { PaymentExpiryCoordinationService } from "./payment-expiry-coordination.service";
import { PaymentExpirySchedulerService } from "./payment-expiry-scheduler.service";
import { PaymentGatewayService } from "./payment-gateway.service";
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
  providers: [
    PaymentsService,
    PaymentGatewayService,
    PaymentLifecycleService,
    PaymentExpiryCoordinationService,
    PaymentExpirySchedulerService
  ],
  exports: [
    PaymentLifecycleService,
    PaymentGatewayService,
    PaymentExpiryCoordinationService,
    PaymentExpirySchedulerService
  ]
})
export class PaymentsModule {}
