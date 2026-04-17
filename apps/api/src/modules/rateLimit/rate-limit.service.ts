import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MemoryRateLimitStore } from "./memory-rate-limit.store";
import { RedisRateLimitStore } from "./redis-rate-limit.store";
import type { RateLimitResult, RateLimitStore } from "./rate-limit.types";

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly preferredStore: "memory" | "redis";
  private redisWarningShown = false;

  constructor(
    configService: ConfigService,
    private readonly memoryStore: MemoryRateLimitStore,
    private readonly redisStore: RedisRateLimitStore
  ) {
    this.preferredStore = configService.get<"memory" | "redis">(
      "RATE_LIMIT_STORE",
      "memory"
    );
  }

  async consume(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const store = this.resolveStore();

    if (store === "redis") {
      try {
        return await this.redisStore.consume(key, maxRequests, windowMs);
      } catch (error) {
        if (!this.redisWarningShown) {
          this.logger.warn(
            `Redis rate limit unavailable, falling back to memory store: ${this.toMessage(error)}`
          );
          this.redisWarningShown = true;
        }
      }
    }

    return this.memoryStore.consume(key, maxRequests, windowMs);
  }

  private resolveStore(): RateLimitStore | "redis" {
    if (this.preferredStore === "redis" && this.redisStore.isConfigured()) {
      return "redis";
    }

    return this.memoryStore;
  }

  private toMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
