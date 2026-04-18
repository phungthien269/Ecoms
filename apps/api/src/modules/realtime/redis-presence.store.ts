import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { Redis as RedisClient } from "ioredis";
import type { PresenceStore } from "./realtime-state.types";

@Injectable()
export class RedisPresenceStore implements PresenceStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisPresenceStore.name);
  private readonly prefix: string;
  private readonly client?: RedisClient;

  constructor(private readonly configService: ConfigService) {
    this.prefix = this.configService.get<string>("REALTIME_REDIS_PREFIX", "ecoms:realtime");
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

  async connect(userId: string, socketId: string) {
    const client = await this.requireClient();
    await client.sadd(this.userSocketsKey(userId), socketId);
  }

  async disconnect(userId: string, socketId: string) {
    const client = await this.requireClient();
    const key = this.userSocketsKey(userId);
    await client.srem(key, socketId);
    const remaining = await client.scard(key);
    if (remaining === 0) {
      await client.del(key);
    }
  }

  async getOnlineUserIds(userIds: string[]) {
    const client = await this.requireClient();
    const pipeline = client.pipeline();
    for (const userId of userIds) {
      pipeline.scard(this.userSocketsKey(userId));
    }
    const results = await pipeline.exec();
    const online = new Set<string>();

    results?.forEach((entry, index) => {
      const [, count] = entry;
      const userId = userIds[index];
      if (userId && typeof count === "number" && count > 0) {
        online.add(userId);
      }
    });

    return online;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  private userSocketsKey(userId: string) {
    return `${this.prefix}:presence:${userId}`;
  }

  private async requireClient() {
    if (!this.client) {
      throw new Error("Redis presence store is not configured");
    }

    if (this.client.status !== "ready" && this.client.status !== "connect") {
      try {
        await this.client.connect();
      } catch (error) {
        this.logger.warn(`Redis connect failed: ${this.toMessage(error)}`);
        throw error;
      }
    }

    return this.client;
  }

  private toMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
