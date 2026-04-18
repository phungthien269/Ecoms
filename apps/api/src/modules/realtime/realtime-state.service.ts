import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MemoryPresenceStore } from "./memory-presence.store";
import { RedisPresenceStore } from "./redis-presence.store";

@Injectable()
export class RealtimeStateService {
  private readonly logger = new Logger(RealtimeStateService.name);
  private readonly preferredStore: "memory" | "redis";
  private redisWarningShown = false;

  constructor(
    configService: ConfigService,
    private readonly memoryStore: MemoryPresenceStore,
    private readonly redisStore: RedisPresenceStore
  ) {
    this.preferredStore = configService.get<"memory" | "redis">(
      "REALTIME_STATE_STORE",
      "memory"
    );
  }

  async connect(userId: string, socketId: string) {
    if (this.shouldUseRedis()) {
      try {
        await this.redisStore.connect(userId, socketId);
        return;
      } catch (error) {
        this.warnFallback(error);
      }
    }

    await this.memoryStore.connect(userId, socketId);
  }

  async disconnect(userId: string, socketId: string) {
    if (this.shouldUseRedis()) {
      try {
        await this.redisStore.disconnect(userId, socketId);
        return;
      } catch (error) {
        this.warnFallback(error);
      }
    }

    await this.memoryStore.disconnect(userId, socketId);
  }

  async getOnlineUserIds(userIds: string[]) {
    if (this.shouldUseRedis()) {
      try {
        return await this.redisStore.getOnlineUserIds(userIds);
      } catch (error) {
        this.warnFallback(error);
      }
    }

    return this.memoryStore.getOnlineUserIds(userIds);
  }

  private shouldUseRedis() {
    return this.preferredStore === "redis" && this.redisStore.isConfigured();
  }

  private warnFallback(error: unknown) {
    if (this.redisWarningShown) {
      return;
    }

    this.logger.warn(
      `Redis realtime state unavailable, falling back to memory store: ${this.toMessage(error)}`
    );
    this.redisWarningShown = true;
  }

  private toMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
