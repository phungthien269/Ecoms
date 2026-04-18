import { ConfigService } from "@nestjs/config";
import { MemoryPresenceStore } from "../src/modules/realtime/memory-presence.store";
import { RealtimeStateService } from "../src/modules/realtime/realtime-state.service";
import { RedisPresenceStore } from "../src/modules/realtime/redis-presence.store";

describe("RealtimeStateService", () => {
  function createService(preferredStore: "memory" | "redis", redisOverrides?: Partial<RedisPresenceStore>) {
    const memoryStore = new MemoryPresenceStore();
    const redisStore = {
      isConfigured: jest.fn().mockReturnValue(preferredStore === "redis"),
      connect: jest.fn(),
      disconnect: jest.fn(),
      getOnlineUserIds: jest.fn().mockResolvedValue(new Set<string>()),
      ...redisOverrides
    } as unknown as RedisPresenceStore;

    const configService = {
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
        if (key === "REALTIME_STATE_STORE") {
          return preferredStore;
        }

        return fallback;
      })
    } as unknown as ConfigService;

    return {
      service: new RealtimeStateService(configService, memoryStore, redisStore),
      redisStore
    };
  }

  it("tracks presence in memory store", async () => {
    const { service } = createService("memory");

    await service.connect("user-1", "socket-1");
    expect(await service.getOnlineUserIds(["user-1", "user-2"])).toEqual(new Set(["user-1"]));

    await service.disconnect("user-1", "socket-1");
    expect(await service.getOnlineUserIds(["user-1"])).toEqual(new Set());
  });

  it("uses redis when preferred and available", async () => {
    const online = new Set(["user-2"]);
    const { service, redisStore } = createService("redis", {
      getOnlineUserIds: jest.fn().mockResolvedValue(online)
    });

    expect(await service.getOnlineUserIds(["user-2"])).toEqual(online);
    expect(redisStore.getOnlineUserIds).toHaveBeenCalledWith(["user-2"]);
  });

  it("falls back to memory when redis presence fails", async () => {
    const { service, redisStore } = createService("redis", {
      connect: jest.fn().mockRejectedValue(new Error("redis down")),
      getOnlineUserIds: jest.fn().mockRejectedValue(new Error("redis down"))
    });

    await service.connect("user-3", "socket-3");

    expect(redisStore.connect).toHaveBeenCalled();
    expect(await service.getOnlineUserIds(["user-3"])).toEqual(new Set(["user-3"]));
  });
});
