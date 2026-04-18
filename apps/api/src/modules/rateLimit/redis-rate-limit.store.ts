import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { Redis as RedisClient } from "ioredis";
import type { RateLimitResult, RateLimitStore } from "./rate-limit.types";

@Injectable()
export class RedisRateLimitStore implements RateLimitStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisRateLimitStore.name);
  private readonly prefix: string;
  private readonly client?: RedisClient;

  constructor(private readonly configService: ConfigService) {
    this.prefix = this.configService.get<string>("RATE_LIMIT_REDIS_PREFIX", "rate-limit");

    const redisUrl = this.configService.get<string>("REDIS_URL");
    if (!redisUrl) {
      return;
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });
  }

  isConfigured() {
    return Boolean(this.client);
  }

  async ping() {
    if (!this.client) {
      return {
        configured: false,
        healthy: false,
        message: "Redis URL not configured"
      };
    }

    await this.ensureConnected();
    const response = await this.client.ping();
    return {
      configured: true,
      healthy: response === "PONG",
      message: response === "PONG" ? "Redis reachable" : `Unexpected redis ping response: ${response}`
    };
  }

  async consume(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    if (!this.client) {
      throw new Error("Redis rate-limit store is not configured");
    }

    const namespacedKey = `${this.prefix}:${key}`;
    await this.ensureConnected();

    const count = await this.client.incr(namespacedKey);
    if (count === 1) {
      await this.client.pexpire(namespacedKey, windowMs);
    }

    const ttl = await this.client.pttl(namespacedKey);
    const safeTtl = ttl > 0 ? ttl : windowMs;
    const resetAt = Date.now() + safeTtl;

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      limit: maxRequests,
      resetAt
    };
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  private async ensureConnected() {
    if (!this.client) {
      return;
    }

    if (this.client.status === "ready" || this.client.status === "connect") {
      return;
    }

    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(`Redis connect failed: ${this.toMessage(error)}`);
      throw error;
    }
  }

  private toMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
