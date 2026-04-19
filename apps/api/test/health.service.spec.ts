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
    probeDiagnostics: jest.fn(),
    sendSafely: jest.fn()
  };
  const filesService = {
    getDiagnostics: jest.fn(),
    probeDiagnostics: jest.fn(),
    createDiagnosticUploadSample: jest.fn()
  };
  const paymentGatewayService = {
    createDiagnosticGatewaySample: jest.fn(),
    getProviderDiagnostics: jest.fn()
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
  const auditLogsService = {
    record: jest.fn(),
    listDiagnosticsActivity: jest.fn()
  };

  const service = new HealthService(
    prisma as never,
    configService as never,
    auditLogsService as never,
    mailerService as never,
    filesService as never,
    paymentGatewayService as never,
    rateLimitService as never,
    realtimeStateService as never,
    paymentExpirySchedulerService as never,
    systemSettingsService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    systemSettingsService.getBooleanValue.mockResolvedValue(true);
    auditLogsService.listDiagnosticsActivity.mockResolvedValue([]);
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
      lastError: null,
      coordination: {
        preferredStore: "memory",
        activeStore: "memory",
        configured: true,
        healthy: true,
        fallbackActive: false,
        instanceId: "instance-1",
        lastOwner: "instance-1",
        message: "Memory coordination active"
      }
    });
    mailerService.sendSafely.mockResolvedValue({
      accepted: true,
      driver: "console"
    });
    filesService.createDiagnosticUploadSample.mockResolvedValue({
      driver: "local",
      objectKey: "healthchecks/sample.txt",
      publicUrl: "http://localhost:4000/uploads/healthchecks/sample.txt",
      upload: {
        strategy: "single_put",
        method: "PUT",
        uploadUrl: "http://localhost:4000/uploads/healthchecks/sample.txt",
        publicUrl: "http://localhost:4000/uploads/healthchecks/sample.txt",
        headers: {
          "content-type": "text/plain"
        },
        expiresAt: null
      }
    });
    paymentGatewayService.createDiagnosticGatewaySample.mockReturnValue({
      provider: "mock_gateway",
      paymentMethod: "ONLINE_GATEWAY",
      referenceCode: "PAY-DIAG-HOST",
      expiresAt: "2026-04-20T00:15:00.000Z",
      metadata: {
        provider: "mock_gateway",
        checkoutMode: "hosted_checkout"
      },
      webhookPayload: {
        paymentId: "payment-online_gateway",
        referenceCode: "PAY-DIAG-HOST",
        event: "PAID"
      },
      webhookSignature: "signed-webhook"
    });
    paymentGatewayService.getProviderDiagnostics.mockReturnValue({
      provider: "mock_gateway",
      displayName: "Mock Gateway",
      mode: "mock_gateway",
      configured: true,
      webhookMode: "internal_mock",
      supportsHostedCheckout: true,
      supportsBankTransfer: true,
      supportsWebhookReplay: true,
      merchantCode: null,
      baseUrl: null,
      actionHint: "Switch to demo_gateway when you want provider-shaped checkout and callback behavior."
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
        skipped: true,
        skipReason: "disabled"
      },
      lastError: null,
      coordination: {
        preferredStore: "memory",
        activeStore: "memory",
        configured: true,
        healthy: true,
        fallbackActive: false,
        instanceId: "instance-1",
        lastOwner: "instance-1",
        message: "Memory coordination active"
      }
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

  it("marks readiness as degraded when payment expiry coordination falls back to memory", async () => {
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
      lastError: null,
      coordination: {
        preferredStore: "redis",
        activeStore: "memory",
        configured: true,
        healthy: true,
        fallbackActive: true,
        instanceId: "instance-1",
        lastOwner: "instance-1",
        message: "Redis coordination unavailable, using in-memory lease"
      }
    });

    const readiness = await service.getReadiness();

    expect(readiness.status).toBe("degraded");
    expect(
      readiness.checks.find((check) => check.key === "payment_expiry_scheduler")?.details
    ).toEqual(
      expect.objectContaining({
        actionHint: "Restore Redis coordination to prevent duplicate sweeps across instances."
      })
    );
  });

  it("sends a diagnostics test email through the configured mailer", async () => {
    const result = await service.sendTestEmail(
      { sub: "admin-1", email: "admin@example.com", role: "ADMIN" },
      "ops@example.com",
      "Ops drill"
    );

    expect(mailerService.sendSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ops@example.com",
        subject: "Ops drill",
        tags: ["diagnostics", "test-email"]
      })
    );
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "health.diagnostics.test_email",
        entityType: "HEALTH_DIAGNOSTIC"
      })
    );
    expect(result).toEqual({
      accepted: true,
      driver: "console",
      recipientEmail: "ops@example.com",
      subject: "Ops drill"
    });
  });

  it("returns a live media upload sample for diagnostics surfaces", async () => {
    const result = await service.getMediaUploadSample({
      sub: "admin-1",
      email: "admin@example.com",
      role: "ADMIN"
    });

    expect(filesService.createDiagnosticUploadSample).toHaveBeenCalled();
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "health.diagnostics.media_upload_sample",
        entityType: "HEALTH_DIAGNOSTIC"
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        driver: "local",
        objectKey: "healthchecks/sample.txt"
      })
    );
  });

  it("returns recent diagnostics activity for operator trace", async () => {
    auditLogsService.listDiagnosticsActivity.mockResolvedValue([
      {
        id: "audit-health-1",
        actorRole: "ADMIN",
        action: "health.diagnostics.test_email",
        entityType: "HEALTH_DIAGNOSTIC",
        entityId: "ops@example.com",
        summary: "Triggered diagnostics test email to ops@example.com",
        metadata: { accepted: true, driver: "console" },
        createdAt: "2026-04-19T01:00:00.000Z",
        actorUser: {
          id: "admin-1",
          fullName: "Ops Admin",
          email: "admin@example.com"
        }
      }
    ]);

    const result = await service.getDiagnosticsActivity();

    expect(auditLogsService.listDiagnosticsActivity).toHaveBeenCalledWith();
    expect(result).toHaveLength(1);
  });

  it("returns payment gateway diagnostics sample and records audit event", async () => {
    const result = await service.getPaymentGatewaySample(
      { sub: "admin-1", email: "admin@example.com", role: "ADMIN" },
      "ONLINE_GATEWAY"
    );

    expect(paymentGatewayService.createDiagnosticGatewaySample).toHaveBeenCalledWith({
      paymentMethod: "ONLINE_GATEWAY"
    });
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "health.diagnostics.payment_gateway_sample",
        entityType: "HEALTH_DIAGNOSTIC"
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        provider: "mock_gateway",
        paymentMethod: "ONLINE_GATEWAY",
        webhookSignature: "signed-webhook"
      })
    );
  });

  it("returns payment provider diagnostics and records operator audit", async () => {
    const result = await service.getPaymentProviderDiagnostics({
      sub: "admin-1",
      email: "admin@example.com",
      role: "ADMIN"
    });

    expect(paymentGatewayService.getProviderDiagnostics).toHaveBeenCalledWith();
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "health.diagnostics.payment_provider",
        entityType: "HEALTH_DIAGNOSTIC"
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        provider: "mock_gateway",
        mode: "mock_gateway"
      })
    );
  });
});
