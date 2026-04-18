import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { MailerModule } from "../mailer/mailer.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RateLimitModule } from "../rateLimit/rate-limit.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [PrismaModule, MailerModule, FilesModule, RateLimitModule, RealtimeModule],
  controllers: [HealthController],
  providers: [HealthService]
})
export class HealthModule {}
