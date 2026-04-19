import { OrderStatus, PaymentMethod, PaymentStatus } from "@ecoms/contracts";
import { PaymentLifecycleService } from "../src/modules/payments/payment-lifecycle.service";

describe("PaymentLifecycleService", () => {
  const prisma = {
    payment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    order: {
      update: jest.fn()
    },
    shop: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  };
  const notificationsService = {
    create: jest.fn()
  };
  const orderStatusHistoryService = {
    record: jest.fn()
  };
  const paymentEventsService = {
    record: jest.fn()
  };

  const service = new PaymentLifecycleService(
    prisma as never,
    notificationsService as never,
    orderStatusHistoryService as never,
    paymentEventsService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    );
  });

  it("expires stale pending payments and cancels pending orders", async () => {
    const now = new Date("2026-04-19T10:00:00.000Z");
    prisma.payment.findMany.mockResolvedValue([
      {
        id: "payment-1",
        orderId: "order-1",
        userId: "user-1",
        status: PaymentStatus.PENDING,
        method: PaymentMethod.ONLINE_GATEWAY,
        expiresAt: new Date("2026-04-19T09:00:00.000Z"),
        metadata: {},
        order: {
          id: "order-1",
          orderNumber: "ORD-1",
          status: OrderStatus.PENDING,
          shopId: "shop-1"
        }
      }
    ]);
    prisma.payment.findUnique.mockResolvedValue({
      id: "payment-1",
      orderId: "order-1",
      userId: "user-1",
      status: PaymentStatus.PENDING,
      method: PaymentMethod.ONLINE_GATEWAY,
      expiresAt: new Date("2026-04-19T09:00:00.000Z"),
      metadata: {},
      order: {
        id: "order-1",
        orderNumber: "ORD-1",
        status: OrderStatus.PENDING,
        shopId: "shop-1"
      }
    });
    prisma.shop.findUnique.mockResolvedValue({
      ownerId: "seller-1"
    });

    const result = await service.expireStalePendingPayments({ now });

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PaymentStatus.PENDING
        })
      })
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentStatus.EXPIRED
        })
      })
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.CANCELLED
        })
      })
    );
    expect(orderStatusHistoryService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        status: OrderStatus.CANCELLED
      }),
      prisma
    );
    expect(paymentEventsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "payment-1",
        eventType: "PAYMENT_EXPIRED",
        nextStatus: PaymentStatus.EXPIRED
      }),
      prisma
    );
    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      expiredCount: 1,
      cancelledOrderCount: 1
    });
  });

  it("supports scoped sweeps by user, order, and seller ownership", async () => {
    prisma.payment.findMany.mockResolvedValue([]);

    await service.expireStalePendingPayments({
      userId: "user-1",
      orderIds: ["order-1"],
      shopOwnerId: "seller-1"
    });

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          orderId: {
            in: ["order-1"]
          },
          order: {
            shop: {
              ownerId: "seller-1"
            }
          }
        })
      })
    );
  });
});
