import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MailerModule } from "../mailer/mailer.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrderStatusHistoryModule } from "../orderStatusHistory/order-status-history.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemSettingsModule } from "../systemSettings/system-settings.module";
import { VouchersModule } from "../vouchers/vouchers.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    VouchersModule,
    NotificationsModule,
    MailerModule,
    OrderStatusHistoryModule,
    SystemSettingsModule
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService]
})
export class CheckoutModule {}
