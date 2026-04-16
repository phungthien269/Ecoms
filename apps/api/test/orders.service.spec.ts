import { ConflictException } from "@nestjs/common";
import { OrderStatus } from "@ecoms/contracts";
import { OrdersService } from "../src/modules/orders/orders.service";

describe("OrdersService", () => {
  const prisma = {
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    }
  };

  const service = new OrdersService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cancels orders before shipping starts", async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      status: OrderStatus.PENDING
    });
    prisma.order.update.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.CANCELLED
    });

    const result = await service.cancel("user-1", "order-1");
    expect(result.status).toBe(OrderStatus.CANCELLED);
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
      status: OrderStatus.DELIVERED
    });
    prisma.order.update.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.COMPLETED
    });

    const result = await service.complete("user-1", "order-1");
    expect(result.status).toBe(OrderStatus.COMPLETED);
  });
});
