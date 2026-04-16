import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { VouchersModule } from "../vouchers/vouchers.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";

@Module({
  imports: [AuthModule, PrismaModule, VouchersModule, NotificationsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService]
})
export class CheckoutModule {}
