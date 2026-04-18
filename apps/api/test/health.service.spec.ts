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
      if (key === "HEALTHCHECK_PROVIDER_PROBES_ENABLED") {
        return true;
      }

      return fallback;
    })
  };
  const mailerService = {
    getDiagnostics: jest.fn(),
    probeDiagnostics: jest.fn()
  };
  const filesService = {
    getDiagnostics: jest.fn(),
    probeDiagnostics: jest.fn()
  };
  const rateLimitService = {
    getDiagnostics: jest.fn()
  };
  const realtimeStateService = {
    getDiagnostics: jest.fn()
  };
  const paymentExpirySchedulerService = {
    getDiagnostics: jest.fn()
  };
  const systemSettingsService = {
    getBooleanValue: jest.fn().mockResolvedValue(true)
  };

  const service = new HealthService(
    prisma as never,
    configService as never,
    mailerService as never,
    filesService as never,
    rateLimitService as never,
    realtimeStateService as never,
    paymentExpirySchedulerService as never,
    systemSettingsService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    systemSettingsService.getBooleanValue.mockResolvedValue(true);
    prisma.ping.mockResolvedValue(true);
    mailerService.getDiagnostics.mockReturnValue({
      driver: "console",
      configured: true,
      healthy: true,
      message: "Console mail driver active"
    });
    mailerService.probeDiagnostics.mockResolvedValue({
      driver: "console",
      configured: true,
      healthy: true,
      message: "Console mail driver active",
      probeStatus: "ok",
      probeMessage: "Console mail driver does not require external probe"
    });
    filesService.getDiagnostics.mockReturnValue({
      driver: "local",
      configured: true,
      healthy: true,
      message: "Local media driver active"
    });
    filesService.probeDiagnostics.mockResolvedValue({
      driver: "local",
      configured: true,
      healthy: true,
      message: "Local media driver active",
      probeStatus: "ok",
      probeMessage: "Local media driver does not require external probe"
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
    paymentExpirySchedulerService.getDiagnostics.mockReturnValue({
      enabled: true,
      running: false,
      lastRunAt: "2026-04-19T00:00:00.000Z",
      nextRunAt: "2026-04-19T00:01:00.000Z",
      lastResult: {
        expiredCount: 0,
        cancelledOrderCount: 0,
        skipped: false
      },
      lastError: null
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

  it("uses probe diagnostics for mail and media when enabled", async () => {
    const readiness = await service.getReadiness();

    expect(systemSettingsService.getBooleanValue).toHaveBeenCalledWith("provider_probes_enabled");
    expect(mailerService.probeDiagnostics).toHaveBeenCalled();
    expect(filesService.probeDiagnostics).toHaveBeenCalled();
    expect(readiness.checks.find((check) => check.key === "mail_driver")?.message).toBe(
      "Console mail driver does not require external probe"
    );
    expect(readiness.checks.find((check) => check.key === "mail_driver")?.details).toEqual(
      expect.objectContaining({
        source: "system_setting",
        actionHint: "No action required"
      })
    );
  });

  it("falls back to static diagnostics when provider probes are disabled", async () => {
    systemSettingsService.getBooleanValue.mockRejectedValue(new Error("settings unavailable"));
    configService.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === "REQUEST_LOGGING_ENABLED") {
        return true;
      }
      if (key === "HEALTHCHECK_PROVIDER_PROBES_ENABLED") {
        return false;
      }

      return fallback;
    });

    const readiness = await service.getReadiness();

    expect(mailerService.probeDiagnostics).not.toHaveBeenCalled();
    expect(filesService.probeDiagnostics).not.toHaveBeenCalled();
    expect(readiness.checks.find((check) => check.key === "provider_probes")?.status).toBe(
      "degraded"
    );
    expect(
      readiness.checks.find((check) => check.key === "provider_probes")?.details
    ).toEqual(
      expect.objectContaining({
        source: "system_setting_or_env_fallback"
      })
    );
  });

  it("marks readiness as degraded when payment expiry scheduler is disabled", async () => {
    paymentExpirySchedulerService.getDiagnostics.mockReturnValue({
      enabled: false,
      running: false,
      lastRunAt: null,
      nextRunAt: "2026-04-19T00:01:00.000Z",
      lastResult: {
        expiredCount: 0,
        cancelledOrderCount: 0,
        skipped: true
      },
      lastError: null
    });

    const readiness = await service.getReadiness();

    expect(readiness.status).toBe("degraded");
    expect(
      readiness.checks.find((check) => check.key === "payment_expiry_scheduler")?.details
    ).toEqual(
      expect.objectContaining({
        actionHint: "Enable payment expiry sweep to enforce timeouts without user interaction."
      })
    );
  });
});
