import { ConflictException } from "@nestjs/common";
import { OrderStatus } from "@ecoms/contracts";
import { OrdersService } from "../src/modules/orders/orders.service";

describe("OrdersService", () => {
  const prisma = {
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn()
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

  const service = new OrdersService(
    prisma as never,
    notificationsService as never,
    mailerService as never
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

    const result = await service.updateAdminStatus("order-1", OrderStatus.REFUNDED);
    expect(result.status).toBe(OrderStatus.REFUNDED);
  });
});
