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

  async getDiagnostics() {
    if (this.preferredStore === "redis") {
      if (!this.redisStore.isConfigured()) {
        return {
          preferredStore: "redis",
          activeStore: "memory",
          configured: false,
          healthy: false,
          fallbackActive: true,
          message: "Redis presence store preferred but REDIS_URL is not configured"
        };
      }

      try {
        const ping = await this.redisStore.ping();
        return {
          preferredStore: "redis",
          activeStore: ping.healthy ? "redis" : "memory",
          configured: ping.configured,
          healthy: ping.healthy,
          fallbackActive: !ping.healthy,
          message: ping.message
        };
      } catch (error) {
        return {
          preferredStore: "redis",
          activeStore: "memory",
          configured: true,
          healthy: false,
          fallbackActive: true,
          message: `Redis unavailable: ${this.toMessage(error)}`
        };
      }
    }

    return {
      preferredStore: "memory",
      activeStore: "memory",
      configured: true,
      healthy: true,
      fallbackActive: false,
      message: "Memory realtime state store active"
    };
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
