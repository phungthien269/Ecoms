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
    sendTestEmail: jest.fn(),
    getMediaUploadSample: jest.fn()
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
    expect(healthService.sendTestEmail).toHaveBeenCalledWith("ops@example.com", "Ops drill");
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
});
