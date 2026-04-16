import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [PrismaModule, NotificationsModule, RealtimeModule],
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule {}
