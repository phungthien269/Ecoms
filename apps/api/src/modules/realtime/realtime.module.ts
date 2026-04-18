import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { MemoryPresenceStore } from "./memory-presence.store";
import { RedisPresenceStore } from "./redis-presence.store";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeStateService } from "./realtime-state.service";

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [
    MemoryPresenceStore,
    RedisPresenceStore,
    RealtimeStateService,
    RealtimeGateway
  ],
  exports: [RealtimeGateway, RealtimeStateService]
})
export class RealtimeModule {}
