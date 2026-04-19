import { requestContextStorage } from "../src/common/request-context";
import { AuditLogsService } from "../src/modules/auditLogs/audit-logs.service";

describe("AuditLogsService", () => {
  const prisma = {
    $transaction: jest.fn(async (operations: unknown) => {
      if (Array.isArray(operations)) {
        return Promise.all(operations);
      }

      throw new Error("Unsupported transaction payload");
    }),
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    }
  };

  const service = new AuditLogsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("records audit events with structured metadata", async () => {
    prisma.auditLog.create.mockResolvedValue({
      id: "audit-1"
    });

    await service.record({
      actorUserId: "admin-1",
      actorRole: "ADMIN",
      action: "orders.admin.update_status",
      entityType: "ORDER",
      entityId: "order-1",
      summary: "Updated order status",
      metadata: {
        previousStatus: "PENDING",
        nextStatus: "REFUNDED"
      }
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "admin-1",
        action: "orders.admin.update_status"
      })
    });
  });

  it("adds requestId from request context into metadata", async () => {
    prisma.auditLog.create.mockResolvedValue({
      id: "audit-2"
    });

    await requestContextStorage.run({ requestId: "req-audit-1" }, async () => {
      await service.record({
        actorUserId: "admin-1",
        actorRole: "ADMIN",
        action: "products.admin.update_status",
        entityType: "PRODUCT",
        entityId: "product-1",
        summary: "Updated product status",
        metadata: {
          nextStatus: "BANNED"
        }
      });
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          requestId: "req-audit-1",
          nextStatus: "BANNED"
        })
      })
    });
  });

  it("lists paginated admin audit logs", async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: "audit-1",
        actorRole: "SUPER_ADMIN",
        action: "system_settings.admin.update",
        entityType: "SYSTEM_SETTING",
        entityId: "payment_timeout_minutes",
        summary: "Updated system setting",
        metadata: { nextValue: 20 },
        createdAt: new Date("2026-04-19T00:00:00.000Z"),
        actorUser: {
          id: "super-1",
          fullName: "Super Admin",
          email: "super@example.com"
        }
      }
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.listAdmin({
      actorRole: "SUPER_ADMIN",
      page: 1,
      pageSize: 20
    });

    expect(result.items[0]).toMatchObject({
      id: "audit-1",
      action: "system_settings.admin.update"
    });
    expect(result.pagination.total).toBe(1);
  });

  it("lists recent diagnostics activity", async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: "audit-health-1",
        actorRole: "ADMIN",
        action: "health.diagnostics.test_email",
        entityType: "HEALTH_DIAGNOSTIC",
        entityId: "ops@example.com",
        summary: "Triggered diagnostics test email to ops@example.com",
        metadata: { accepted: true, driver: "console" },
        createdAt: new Date("2026-04-19T01:00:00.000Z"),
        actorUser: {
          id: "admin-1",
          fullName: "Ops Admin",
          email: "admin@example.com"
        }
      }
    ]);

    const result = await service.listDiagnosticsActivity(5);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType: "HEALTH_DIAGNOSTIC"
        },
        take: 5
      })
    );
    expect(result[0]).toMatchObject({
      action: "health.diagnostics.test_email",
      entityType: "HEALTH_DIAGNOSTIC"
    });
  });
});
