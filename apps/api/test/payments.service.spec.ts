import { ConflictException } from "@nestjs/common";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@ecoms/contracts";
import { PaymentsService } from "../src/modules/payments/payments.service";

describe("PaymentsService", () => {
  const prisma = {
    payment: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    shop: {
      findUnique: jest.fn()
    },
    order: {
      update: jest.fn()
    },
    $transaction: jest.fn()
  };
  const notificationsService = {
    create: jest.fn()
  };

  const service = new PaymentsService(prisma as never, notificationsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockResolvedValue([]);
  });

  it("confirms a pending non-COD payment and updates the order", async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: "payment-1",
      orderId: "order-1",
      userId: "user-1",
      method: PaymentMethod.ONLINE_GATEWAY,
      status: PaymentStatus.PENDING,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      metadata: {},
      order: {
        id: "order-1",
        status: OrderStatus.PENDING,
        shopId: "shop-1",
        orderNumber: "ORD-1"
      }
    });
    prisma.shop.findUnique.mockResolvedValue({
      ownerId: "seller-1",
      name: "Demo Seller Shop"
    });

    const result = await service.confirm("user-1", "payment-1");

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      paymentId: "payment-1",
      orderId: "order-1",
      status: PaymentStatus.PAID
    });
  });

  it("rejects COD confirmation requests", async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: "payment-1",
      orderId: "order-1",
      userId: "user-1",
      method: PaymentMethod.COD,
      status: PaymentStatus.PAID,
      order: {
        id: "order-1",
        status: OrderStatus.CONFIRMED,
        shopId: "shop-1",
        orderNumber: "ORD-1"
      }
    });

    await expect(service.confirm("user-1", "payment-1")).rejects.toBeInstanceOf(
      ConflictException
    );
  });
});
