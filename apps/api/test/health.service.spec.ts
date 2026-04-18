import { ServiceUnavailableException } from "@nestjs/common";
import { HealthService } from "../src/modules/health/health.service";

describe("HealthService", () => {
  const prisma = {
    ping: jest.fn()
  };
  const configService = {
    get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
      if (key === "REQUEST_LOGGING_ENABLED") {
        return true;
      }

      return fallback;
    })
  };
  const mailerService = {
    getDiagnostics: jest.fn()
  };
  const filesService = {
    getDiagnostics: jest.fn()
  };
  const rateLimitService = {
    getDiagnostics: jest.fn()
  };
  const realtimeStateService = {
    getDiagnostics: jest.fn()
  };

  const service = new HealthService(
    prisma as never,
    configService as never,
    mailerService as never,
    filesService as never,
    rateLimitService as never,
    realtimeStateService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.ping.mockResolvedValue(true);
    mailerService.getDiagnostics.mockReturnValue({
      driver: "console",
      configured: true,
      healthy: true,
      message: "Console mail driver active"
    });
    filesService.getDiagnostics.mockReturnValue({
      driver: "local",
      configured: true,
      healthy: true,
      message: "Local media driver active"
    });
    rateLimitService.getDiagnostics.mockResolvedValue({
      preferredStore: "memory",
      activeStore: "memory",
      configured: true,
      healthy: true,
      fallbackActive: false,
      message: "Memory rate limit store active"
    });
    realtimeStateService.getDiagnostics.mockResolvedValue({
      preferredStore: "memory",
      activeStore: "memory",
      configured: true,
      healthy: true,
      fallbackActive: false,
      message: "Memory realtime state store active"
    });
  });

  it("returns ok readiness when database is reachable", async () => {
    const readiness = await service.getReadiness();

    expect(readiness.ready).toBe(true);
    expect(readiness.status).toBe("ok");
    expect(readiness.checks.find((check) => check.key === "database")?.status).toBe("ok");
  });

  it("throws service unavailable when readiness fails on database health", async () => {
    prisma.ping.mockRejectedValue(new Error("db down"));

    await expect(service.assertReady()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("marks readiness as degraded when optional providers fallback", async () => {
    rateLimitService.getDiagnostics.mockResolvedValue({
      preferredStore: "redis",
      activeStore: "memory",
      configured: true,
      healthy: false,
      fallbackActive: true,
      message: "Redis unavailable"
    });

    const readiness = await service.getReadiness();
    expect(readiness.ready).toBe(true);
    expect(readiness.status).toBe("degraded");
  });
});
