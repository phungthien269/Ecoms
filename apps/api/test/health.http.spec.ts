import type { INestApplication } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import request from "supertest";
import { HealthController } from "../src/modules/health/health.controller";
import { HealthService } from "../src/modules/health/health.service";
import { createHttpTestApp } from "./support/create-http-test-app";

describe("HealthController (http)", () => {
  let app: INestApplication;
  const healthService = {
    getHealth: jest.fn(),
    assertReady: jest.fn(),
    getDiagnostics: jest.fn(),
    getDiagnosticsActivity: jest.fn(),
    sendTestEmail: jest.fn(),
    getMediaUploadSample: jest.fn(),
    getPaymentGatewaySample: jest.fn(),
    getPaymentProviderDiagnostics: jest.fn()
  } satisfies Partial<HealthService>;

  beforeAll(async () => {
    app = await createHttpTestApp({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService
        }
      ]
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("serves public liveness status", async () => {
    healthService.getHealth.mockReturnValue({
      status: "ok",
      timestamp: "2026-04-19T00:00:00.000Z",
      service: "ecoms-api"
    });

    const response = await request(app.getHttpServer()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(healthService.getHealth).toHaveBeenCalled();
  });

  it("blocks diagnostics for customers", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/health/diagnostics")
      .set("x-test-user-id", "buyer-1")
      .set("x-test-user-role", UserRole.CUSTOMER);

    expect(response.status).toBe(403);
    expect(healthService.getDiagnostics).not.toHaveBeenCalled();
  });

  it("allows admin diagnostics access", async () => {
    healthService.getDiagnostics.mockResolvedValue({
      status: "degraded",
      timestamp: "2026-04-19T00:00:00.000Z",
      service: "ecoms-api",
      ready: true,
      checks: []
    });

    const response = await request(app.getHttpServer())
      .get("/api/health/diagnostics")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", UserRole.ADMIN);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(healthService.getDiagnostics).toHaveBeenCalled();
  });

  it("allows admin diagnostics history access", async () => {
    healthService.getDiagnosticsActivity.mockResolvedValue([
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

    const response = await request(app.getHttpServer())
      .get("/api/health/diagnostics/history")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", UserRole.ADMIN);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(healthService.getDiagnosticsActivity).toHaveBeenCalled();
  });

  it("allows admin to send a diagnostics test email", async () => {
    healthService.sendTestEmail.mockResolvedValue({
      accepted: true,
      driver: "console",
      recipientEmail: "ops@example.com",
      subject: "Ops drill"
    });

    const response = await request(app.getHttpServer())
      .post("/api/health/diagnostics/test-email")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", UserRole.ADMIN)
      .send({
        recipientEmail: "ops@example.com",
        subject: "Ops drill"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(healthService.sendTestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "admin-1",
        role: UserRole.ADMIN
      }),
      "ops@example.com",
      "Ops drill"
    );
  });

  it("allows admin to request a media upload sample", async () => {
    healthService.getMediaUploadSample.mockResolvedValue({
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

    const response = await request(app.getHttpServer())
      .get("/api/health/diagnostics/media-upload-sample")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", UserRole.ADMIN);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(healthService.getMediaUploadSample).toHaveBeenCalled();
  });

  it("allows admin to request a payment gateway sample", async () => {
    healthService.getPaymentGatewaySample.mockResolvedValue({
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

    const response = await request(app.getHttpServer())
      .get("/api/health/diagnostics/payment-gateway-sample")
      .query({ paymentMethod: "ONLINE_GATEWAY" })
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", UserRole.ADMIN);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(healthService.getPaymentGatewaySample).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "admin-1",
        role: UserRole.ADMIN
      }),
      "ONLINE_GATEWAY"
    );
  });

  it("allows admin to request payment provider diagnostics", async () => {
    healthService.getPaymentProviderDiagnostics.mockResolvedValue({
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

    const response = await request(app.getHttpServer())
      .get("/api/health/diagnostics/payment-provider")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", UserRole.ADMIN);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(healthService.getPaymentProviderDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "admin-1",
        role: UserRole.ADMIN
      })
    );
  });
});
