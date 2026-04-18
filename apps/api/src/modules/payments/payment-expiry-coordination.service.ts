import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { Redis as RedisClient } from "ioredis";
import { randomUUID } from "node:crypto";

@Injectable()
export class PaymentExpiryCoordinationService implements OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpiryCoordinationService.name);
  private readonly preferredStore: "memory" | "redis";
  private readonly prefix: string;
  private readonly instanceId = randomUUID();
  private readonly client?: RedisClient;
  private memoryLeaseOwner: string | null = null;
  private memoryLeaseExpiresAt = 0;
  private activeStore: "memory" | "redis";
  private lastOwner: string | null = null;
  private fallbackActive = false;
  private lastMessage = "Memory coordination active";

  constructor(private readonly configService: ConfigService) {
    this.preferredStore = this.configService.get<"memory" | "redis">(
      "PAYMENT_EXPIRY_COORDINATION_STORE",
      "memory"
    );
    this.prefix = this.configService.get<string>(
      "PAYMENT_EXPIRY_REDIS_PREFIX",
      "ecoms:payment-expiry"
    );

    const redisUrl = this.configService.get<string>("REDIS_URL");
    if (this.preferredStore === "redis" && redisUrl) {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false
      });
      this.activeStore = "redis";
      this.lastMessage = "Redis coordination active";
      return;
    }

    this.activeStore = "memory";
    this.fallbackActive = this.preferredStore === "redis";
    this.lastMessage = this.fallbackActive
      ? "Redis coordination unavailable, using in-memory lease"
      : "Memory coordination active";
  }

  async tryAcquireLease(ttlMs: number) {
    if (this.activeStore === "redis") {
      return this.tryAcquireRedisLease(ttlMs);
    }

    return this.tryAcquireMemoryLease(ttlMs);
  }

  getDiagnostics() {
    return {
      preferredStore: this.preferredStore,
      activeStore: this.activeStore,
      configured: this.activeStore === "memory" ? true : Boolean(this.client),
      healthy: this.activeStore === "memory" || Boolean(this.client),
      fallbackActive: this.fallbackActive,
      instanceId: this.instanceId,
      lastOwner: this.lastOwner,
      message: this.lastMessage
    };
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  private async tryAcquireRedisLease(ttlMs: number) {
    if (!this.client) {
      this.activateMemoryFallback("Redis coordination not configured, using in-memory lease");
      return this.tryAcquireMemoryLease(ttlMs);
    }

    try {
      await this.ensureConnected();
      const result = await this.client.set(this.leaseKey(), this.instanceId, "PX", ttlMs, "NX");
      if (result === "OK") {
        this.lastOwner = this.instanceId;
        this.lastMessage = "Redis coordination active";
        return { acquired: true as const, owner: this.instanceId };
      }

      const owner = await this.client.get(this.leaseKey());
      if (owner === this.instanceId) {
        await this.client.pexpire(this.leaseKey(), ttlMs);
        this.lastOwner = this.instanceId;
        this.lastMessage = "Redis coordination active";
        return { acquired: true as const, owner: this.instanceId };
      }

      this.lastOwner = owner;
      this.lastMessage = owner
        ? `Redis lease held by ${owner}`
        : "Redis lease already held by another instance";
      return {
        acquired: false as const,
        owner
      };
    } catch (error) {
      this.activateMemoryFallback(
        `Redis coordination unavailable, using in-memory lease: ${this.toMessage(error)}`
      );
      return this.tryAcquireMemoryLease(ttlMs);
    }
  }

  private tryAcquireMemoryLease(ttlMs: number) {
    const now = Date.now();
    if (this.memoryLeaseOwner && this.memoryLeaseExpiresAt > now) {
      this.lastOwner = this.memoryLeaseOwner;
      this.lastMessage =
        this.memoryLeaseOwner === this.instanceId
          ? "Memory coordination active"
          : `Memory lease held by ${this.memoryLeaseOwner}`;
      return {
        acquired: this.memoryLeaseOwner === this.instanceId,
        owner: this.memoryLeaseOwner
      };
    }

    this.memoryLeaseOwner = this.instanceId;
    this.memoryLeaseExpiresAt = now + ttlMs;
    this.lastOwner = this.instanceId;
    this.lastMessage = this.fallbackActive
      ? "Redis coordination unavailable, using in-memory lease"
      : "Memory coordination active";
    return {
      acquired: true as const,
      owner: this.instanceId
    };
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

  private activateMemoryFallback(message: string) {
    this.activeStore = "memory";
    this.fallbackActive = this.preferredStore === "redis";
    this.lastMessage = message;
  }

  private leaseKey() {
    return `${this.prefix}:lease`;
  }

  private toMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
