import { AdminDashboardService } from "../src/modules/adminDashboard/adminDashboard.service";

describe("AdminDashboardService", () => {
  const prisma = {
    user: { count: jest.fn() },
    shop: { count: jest.fn(), findMany: jest.fn() },
    product: { count: jest.fn(), findMany: jest.fn() },
    order: { count: jest.fn(), findMany: jest.fn() },
    payment: { count: jest.fn() },
    review: { count: jest.fn() },
    flashSale: { count: jest.fn() },
    report: { count: jest.fn() }
  };

  const service = new AdminDashboardService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.count.mockResolvedValue(12);
    prisma.shop.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    prisma.product.count
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(1);
    prisma.order.count.mockResolvedValue(8);
    prisma.payment.count.mockResolvedValue(3);
    prisma.flashSale.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    prisma.report.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2);
    prisma.review.count.mockResolvedValue(6);
    prisma.order.findMany.mockResolvedValue([]);
    prisma.shop.findMany.mockResolvedValue([]);
    prisma.product.findMany.mockResolvedValue([]);
  });

  it("returns aggregate moderation stats", async () => {
    const summary = await service.getSummary();

    expect(summary.stats.totalUsers).toBe(12);
    expect(summary.stats.pendingShops).toBe(2);
    expect(summary.stats.pendingPayments).toBe(3);
    expect(summary.stats.totalFlashSales).toBe(4);
    expect(summary.stats.totalReports).toBe(7);
    expect(summary.stats.openReports).toBe(2);
    expect(summary.recentOrders).toEqual([]);
  });
});
