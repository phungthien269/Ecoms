import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrderStatusHistoryModule } from "../orderStatusHistory/order-status-history.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentsController } from "./payments.controller";
import { PaymentLifecycleService } from "./payment-lifecycle.service";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [ConfigModule, AuthModule, PrismaModule, NotificationsModule, OrderStatusHistoryModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentLifecycleService],
  exports: [PaymentLifecycleService]
})
export class PaymentsModule {}
