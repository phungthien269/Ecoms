import { ConflictException } from "@nestjs/common";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@ecoms/contracts";
import { PaymentsService } from "../src/modules/payments/payments.service";

describe("PaymentsService", () => {
  const prisma = {
    payment: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    order: {
      update: jest.fn()
    },
    $transaction: jest.fn()
  };

  const service = new PaymentsService(prisma as never);

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
        status: OrderStatus.PENDING
      }
    });

    const result = await service.confirm("user-1", "payment-1");

    expect(prisma.$transaction).toHaveBeenCalled();
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
        status: OrderStatus.CONFIRMED
      }
    });

    await expect(service.confirm("user-1", "payment-1")).rejects.toBeInstanceOf(
      ConflictException
    );
  });
});
