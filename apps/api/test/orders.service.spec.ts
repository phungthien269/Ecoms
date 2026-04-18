import { ConflictException } from "@nestjs/common";
import { OrderStatus } from "@ecoms/contracts";
import { OrdersService } from "../src/modules/orders/orders.service";

describe("OrdersService", () => {
  const prisma = {
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === "function") {
        return input(prisma);
      }

      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      throw new Error("Unsupported transaction payload");
    }),
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn()
    },
    shop: {
      findUnique: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    }
  };
  const notificationsService = {
    create: jest.fn()
  };
  const mailerService = {
    sendSafely: jest.fn()
  };
  const orderStatusHistoryService = {
    record: jest.fn(),
    listForOrder: jest.fn(),
    getLatestStatusTimestamp: jest.fn()
  };
  const auditLogsService = {
    record: jest.fn()
  };

  const service = new OrdersService(
    prisma as never,
    notificationsService as never,
    mailerService as never,
    orderStatusHistoryService as never,
    auditLogsService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cancels orders before shipping starts", async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      shopId: "shop-1",
      orderNumber: "ORD-1",
      status: OrderStatus.PENDING
    });
    prisma.order.update.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.CANCELLED
    });
    prisma.shop.findUnique.mockResolvedValue({
      ownerId: "seller-1"
    });

    const result = await service.cancel("user-1", "order-1");
    expect(result.status).toBe(OrderStatus.CANCELLED);
    expect(notificationsService.create).toHaveBeenCalled();
    expect(orderStatusHistoryService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        status: OrderStatus.CANCELLED
      }),
      prisma
    );
  });

  it("blocks cancelling shipped orders", async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      status: OrderStatus.SHIPPING
    });

    await expect(service.cancel("user-1", "order-1")).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("marks delivered orders as completed", async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      shopId: "shop-1",
      orderNumber: "ORD-1",
      status: OrderStatus.DELIVERED
    });
    prisma.order.update.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.COMPLETED
    });
    prisma.shop.findUnique.mockResolvedValue({
      ownerId: "seller-1"
    });
    prisma.user.findUnique.mockResolvedValue({
      email: "buyer@example.com",
      fullName: "Demo Buyer"
    });

    const result = await service.complete("user-1", "order-1");
    expect(result.status).toBe(OrderStatus.COMPLETED);
    expect(orderStatusHistoryService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        status: OrderStatus.COMPLETED
      }),
      prisma
    );
    expect(mailerService.sendSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        tags: ["order_completed"]
      })
    );
  });

  it("allows seller confirmation for COD orders", async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      shopId: "shop-1",
      orderNumber: "ORD-1",
      status: OrderStatus.PENDING,
      paymentMethod: "COD",
      payments: [{ status: "PENDING" }]
    });
    prisma.order.update.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.CONFIRMED
    });

    const result = await service.updateSellerStatus("seller-1", "order-1", OrderStatus.CONFIRMED);
    expect(result.status).toBe(OrderStatus.CONFIRMED);
  });

  it("blocks seller confirmation for unpaid online orders", async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      shopId: "shop-1",
      userId: "user-1",
      orderNumber: "ORD-1",
      status: OrderStatus.PENDING,
      paymentMethod: "ONLINE_GATEWAY",
      payments: [{ status: "PENDING" }]
    });

    await expect(
      service.updateSellerStatus("seller-1", "order-1", OrderStatus.CONFIRMED)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks invalid seller status jumps", async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      shopId: "shop-1",
      userId: "user-1",
      orderNumber: "ORD-1",
      status: OrderStatus.PENDING,
      paymentMethod: "COD",
      payments: [{ status: "PENDING" }]
    });

    await expect(
      service.updateSellerStatus("seller-1", "order-1", OrderStatus.SHIPPING)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows admin to set terminal moderation statuses", async () => {
    prisma.order.findUnique = jest.fn().mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      orderNumber: "ORD-1",
      status: OrderStatus.SHIPPING
    });
    prisma.order.update.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.REFUNDED
    });

    const result = await service.updateAdminStatus(
      { sub: "admin-1", email: "admin@example.com", role: "ADMIN" },
      "order-1",
      OrderStatus.REFUNDED
    );
    expect(result.status).toBe(OrderStatus.REFUNDED);
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "orders.admin.update_status",
        entityId: "order-1"
      })
    );
  });

  it("lists paginated admin orders with filters", async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: "order-1",
        orderNumber: "ORD-1",
        status: OrderStatus.PENDING,
        paymentMethod: "COD",
        itemsSubtotal: { toString: () => "100000" },
        shippingFee: { toString: () => "20000" },
        discountTotal: { toString: () => "0" },
        grandTotal: { toString: () => "120000" },
        placedAt: new Date("2026-04-18T00:00:00.000Z"),
        user: {
          id: "user-1",
          fullName: "Buyer Demo",
          email: "buyer@example.com"
        },
        shop: {
          id: "shop-1",
          name: "Demo Shop",
          slug: "demo-shop",
          status: "ACTIVE"
        },
        payments: []
      }
    ]);
    prisma.order.count.mockResolvedValue(1);

    const result = await service.listAdmin({
      search: "buyer",
      status: OrderStatus.PENDING,
      page: 1,
      pageSize: 12
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 12,
        where: expect.objectContaining({
          status: OrderStatus.PENDING,
          OR: expect.any(Array)
        })
      })
    );
    expect(result.items[0]).toMatchObject({
      id: "order-1",
      customer: {
        id: "user-1"
      },
      shop: {
        id: "shop-1"
      }
    });
    expect(result.pagination.total).toBe(1);
  });

  it("allows buyer to request return within 7 days after delivery", async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      shopId: "shop-1",
      orderNumber: "ORD-1",
      status: OrderStatus.DELIVERED,
      updatedAt: new Date("2026-04-18T06:00:00.000Z")
    });
    prisma.order.update.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.RETURN_REQUESTED
    });
    prisma.shop.findUnique.mockResolvedValue({
      ownerId: "seller-1"
    });
    orderStatusHistoryService.listForOrder.mockResolvedValue([
      {
        id: "hist-1",
        status: OrderStatus.DELIVERED,
        actorType: "SELLER",
        actorUser: null,
        note: null,
        metadata: null,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]);

    const result = await service.requestReturn("user-1", "order-1", {
      reason: "Wrong size",
      details: "Need exchange"
    });

    expect(result.status).toBe(OrderStatus.RETURN_REQUESTED);
    expect(orderStatusHistoryService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        status: OrderStatus.RETURN_REQUESTED,
        note: "Wrong size"
      }),
      prisma
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "seller-1"
      })
    );
  });

  it("blocks return requests after the 7 day window", async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      shopId: "shop-1",
      orderNumber: "ORD-1",
      status: OrderStatus.COMPLETED,
      updatedAt: new Date("2026-04-18T06:00:00.000Z")
    });
    orderStatusHistoryService.listForOrder.mockResolvedValue([
      {
        id: "hist-1",
        status: OrderStatus.DELIVERED,
        actorType: "SELLER",
        actorUser: null,
        note: null,
        metadata: null,
        createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]);

    await expect(
      service.requestReturn("user-1", "order-1", {
        reason: "Late damage"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
