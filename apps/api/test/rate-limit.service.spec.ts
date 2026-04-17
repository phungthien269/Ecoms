import { ConfigService } from "@nestjs/config";
import { MemoryRateLimitStore } from "../src/modules/rateLimit/memory-rate-limit.store";
import { RateLimitService } from "../src/modules/rateLimit/rate-limit.service";
import { RedisRateLimitStore } from "../src/modules/rateLimit/redis-rate-limit.store";

describe("RateLimitService", () => {
  function createService(preferredStore: "memory" | "redis", redisStoreOverrides?: Partial<RedisRateLimitStore>) {
    const memoryStore = new MemoryRateLimitStore();
    const redisStore = {
      isConfigured: jest.fn().mockReturnValue(preferredStore === "redis"),
      consume: jest.fn(),
      ...redisStoreOverrides
    } as unknown as RedisRateLimitStore;

    const configService = {
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
        if (key === "RATE_LIMIT_STORE") {
          return preferredStore;
        }

        return fallback;
      })
    } as unknown as ConfigService;

    return {
      service: new RateLimitService(configService, memoryStore, redisStore),
      redisStore
    };
  }

  it("allows requests within the configured limit on memory store", async () => {
    const { service } = createService("memory");

    const first = await service.consume("auth:127.0.0.1", 2, 1000);
    const second = await service.consume("auth:127.0.0.1", 2, 1000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it("blocks requests after the configured limit on memory store", async () => {
    const { service } = createService("memory");

    await service.consume("chat:127.0.0.2", 1, 1000);
    const blocked = await service.consume("chat:127.0.0.2", 1, 1000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("uses redis when configured and available", async () => {
    const { service, redisStore } = createService("redis", {
      consume: jest.fn().mockResolvedValue({
        allowed: true,
        remaining: 4,
        limit: 5,
        resetAt: Date.now() + 1000
      })
    });

    const result = await service.consume("reports:user-1", 5, 1000);

    expect(redisStore.consume).toHaveBeenCalledWith("reports:user-1", 5, 1000);
    expect(result.remaining).toBe(4);
  });

  it("falls back to memory when redis consume fails", async () => {
    const { service, redisStore } = createService("redis", {
      consume: jest.fn().mockRejectedValue(new Error("redis down"))
    });

    const first = await service.consume("files:user-2", 1, 1000);
    const blocked = await service.consume("files:user-2", 1, 1000);

    expect(redisStore.consume).toHaveBeenCalled();
    expect(first.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
  });
});
