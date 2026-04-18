import type { INestApplication } from "@nestjs/common";
import {
  ReportStatus,
  ReportTargetType,
  UserRole
} from "@ecoms/contracts";
import request from "supertest";
import { ReportsController } from "../src/modules/reports/reports.controller";
import { ReportsService } from "../src/modules/reports/reports.service";
import { createHttpTestApp } from "./support/create-http-test-app";

describe("ReportsController (http)", () => {
  let app: INestApplication;
  const reportsService = {
    create: jest.fn(),
    listAdmin: jest.fn(),
    updateStatus: jest.fn()
  } satisfies Partial<ReportsService>;

  beforeAll(async () => {
    app = await createHttpTestApp({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: reportsService
        }
      ],
      configValues: {
        REPORT_RATE_LIMIT_MAX: 1,
        REPORT_RATE_LIMIT_WINDOW_MS: 60_000
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates report with rate-limit headers and wrapped response", async () => {
    reportsService.create.mockResolvedValue({
      id: "report-1",
      status: ReportStatus.OPEN
    });

    const response = await request(app.getHttpServer())
      .post("/api/reports")
      .set("x-test-user-id", "buyer-1")
      .send({
        targetType: ReportTargetType.PRODUCT,
        targetId: "product-1",
        reason: "Fake item"
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: "report-1",
        status: ReportStatus.OPEN
      }
    });
    expect(response.headers["x-ratelimit-limit"]).toBe("1");
    expect(response.headers["x-ratelimit-remaining"]).toBe("0");
  });

  it("returns 429 when report create exceeds rate limit", async () => {
    reportsService.create.mockResolvedValue({
      id: "report-2",
      status: ReportStatus.OPEN
    });

    await request(app.getHttpServer())
      .post("/api/reports")
      .set("x-test-user-id", "buyer-rate-limit")
      .send({
        targetType: ReportTargetType.PRODUCT,
        targetId: "product-1",
        reason: "Spam listing"
      });

    const response = await request(app.getHttpServer())
      .post("/api/reports")
      .set("x-test-user-id", "buyer-rate-limit")
      .send({
        targetType: ReportTargetType.PRODUCT,
        targetId: "product-2",
        reason: "Spam listing"
      });

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Too many requests");
    expect(reportsService.create).toHaveBeenCalledTimes(1);
  });

  it("allows admin moderation update through guarded endpoint", async () => {
    reportsService.updateStatus.mockResolvedValue({
      id: "report-1",
      status: ReportStatus.RESOLVED
    });

    const response = await request(app.getHttpServer())
      .patch("/api/reports/admin/report-1/status")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", UserRole.ADMIN)
      .send({
        status: ReportStatus.RESOLVED,
        moderationAction: "BAN_PRODUCT",
        resolvedNote: "Removed abusive listing"
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(reportsService.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "admin-1",
        role: UserRole.ADMIN
      }),
      "report-1",
      expect.objectContaining({
        status: ReportStatus.RESOLVED,
        moderationAction: "BAN_PRODUCT"
      })
    );
  });
});
