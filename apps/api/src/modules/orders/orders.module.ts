import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MailerModule } from "../mailer/mailer.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule, MailerModule],
  controllers: [OrdersController],
  providers: [OrdersService]
})
export class OrdersModule {}
