import { BadRequestException } from "@nestjs/common";
import { SystemSettingsService } from "../src/modules/systemSettings/system-settings.service";

describe("SystemSettingsService", () => {
  const prisma = {
    systemSetting: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn()
    }
  };
  const auditLogsService = {
    record: jest.fn()
  };

  const service = new SystemSettingsService(prisma as never, auditLogsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists merged system settings with defaults", async () => {
    prisma.systemSetting.findMany.mockResolvedValue([
      {
        key: "payment_timeout_minutes",
        value: 25,
        updatedAt: new Date("2026-04-19T00:00:00.000Z"),
        updatedBy: {
          id: "super-1",
          fullName: "Super Admin",
          email: "super@example.com"
        }
      }
    ]);

    const result = await service.listAdmin();

    expect(result.find((item) => item.key === "payment_timeout_minutes")?.value).toBe(25);
    expect(result.find((item) => item.key === "marketplace_name")?.value).toBe("Ecoms");
  });

  it("updates a setting and records an audit log", async () => {
    prisma.systemSetting.findUnique.mockResolvedValue({
      key: "payment_timeout_minutes",
      value: 15
    });
    prisma.systemSetting.upsert.mockResolvedValue({
      key: "payment_timeout_minutes",
      value: 25,
      updatedAt: new Date("2026-04-19T01:00:00.000Z"),
      updatedBy: {
        id: "super-1",
        fullName: "Super Admin",
        email: "super@example.com"
      }
    });

    const result = await service.update(
      { sub: "super-1", email: "super@example.com", role: "SUPER_ADMIN" },
      "payment_timeout_minutes",
      "25"
    );

    expect(result.value).toBe(25);
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "system_settings.admin.update",
        entityId: "payment_timeout_minutes"
      })
    );
  });

  it("returns public summary for storefront/runtime consumers", async () => {
    prisma.systemSetting.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === "marketplace_name") {
        return { key: "marketplace_name", value: "Ops Demo" };
      }

      if (where.key === "support_email") {
        return { key: "support_email", value: "ops@example.com" };
      }

      if (where.key === "payment_timeout_minutes") {
        return { key: "payment_timeout_minutes", value: 20 };
      }

      if (where.key === "order_auto_complete_days") {
        return { key: "order_auto_complete_days", value: 5 };
      }

      return null;
    });

    const result = await service.getPublicSummary();

    expect(result).toEqual({
      marketplaceName: "Ops Demo",
      supportEmail: "ops@example.com",
      paymentTimeoutMinutes: 20,
      orderAutoCompleteDays: 5
    });
  });

  it("rejects invalid boolean values", async () => {
    await expect(
      service.update(
        { sub: "super-1", email: "super@example.com", role: "SUPER_ADMIN" },
        "seller_registration_enabled",
        "maybe"
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
