import { ConflictException, NotFoundException } from "@nestjs/common";
import { ReportsService } from "../src/modules/reports/reports.service";

describe("ReportsService", () => {
  const prisma = {
    product: {
      findFirst: jest.fn()
    },
    shop: {
      findFirst: jest.fn()
    },
    review: {
      findUnique: jest.fn()
    },
    report: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    user: {
      findMany: jest.fn()
    }
  };

  const notificationsService = {
    create: jest.fn()
  };

  const service = new ReportsService(prisma as never, notificationsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a product report and notifies admins", async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: "product-1",
      name: "Gaming Mouse Pro"
    });
    prisma.report.findFirst.mockResolvedValue(null);
    prisma.report.create.mockResolvedValue({
      id: "report-1",
      targetType: "PRODUCT",
      reason: "Counterfeit risk",
      details: "Suspicious branding",
      status: "OPEN",
      resolvedNote: null,
      resolvedAt: null,
      createdAt: new Date("2026-04-18T00:00:00.000Z")
    });
    prisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);

    const result = await service.create("buyer-1", {
      targetType: "PRODUCT",
      targetId: "product-1",
      reason: "Counterfeit risk",
      details: "Suspicious branding"
    });

    expect(result.status).toBe("OPEN");
    expect(notificationsService.create).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate active reports from the same user", async () => {
    prisma.shop.findFirst.mockResolvedValue({
      id: "shop-1",
      name: "Demo Shop"
    });
    prisma.report.findFirst.mockResolvedValue({
      id: "report-1"
    });

    await expect(
      service.create("buyer-1", {
        targetType: "SHOP",
        targetId: "shop-1",
        reason: "Misleading shop",
        details: "Repeated issue"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("updates report status and notifies the reporter", async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: "report-1",
      reporter: {
        id: "buyer-1"
      }
    });
    prisma.report.update.mockResolvedValue({
      id: "report-1",
      status: "RESOLVED",
      resolvedNote: "Handled by admin",
      resolvedAt: new Date("2026-04-18T01:00:00.000Z")
    });

    const result = await service.updateStatus("admin-1", "report-1", {
      status: "RESOLVED",
      resolvedNote: "Handled by admin"
    });

    expect(result.status).toBe("RESOLVED");
    expect(notificationsService.create).toHaveBeenCalled();
  });

  it("fails when target does not exist", async () => {
    prisma.review.findUnique.mockResolvedValue(null);

    await expect(
      service.create("buyer-1", {
        targetType: "REVIEW",
        targetId: "review-1",
        reason: "Abusive content"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
