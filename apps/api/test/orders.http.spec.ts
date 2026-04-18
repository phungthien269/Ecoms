import type { INestApplication } from "@nestjs/common";
import { OrderStatus, UserRole } from "@ecoms/contracts";
import request from "supertest";
import { OrdersController } from "../src/modules/orders/orders.controller";
import { OrdersService } from "../src/modules/orders/orders.service";
import { createHttpTestApp } from "./support/create-http-test-app";

describe("OrdersController (http)", () => {
  let app: INestApplication;
  const ordersService = {
    listOwn: jest.fn(),
    listAdmin: jest.fn(),
    updateAdminStatus: jest.fn(),
    listSellerOrders: jest.fn(),
    getSellerOrderDetail: jest.fn(),
    getOwnDetail: jest.fn(),
    cancel: jest.fn(),
    complete: jest.fn(),
    requestReturn: jest.fn(),
    updateSellerStatus: jest.fn()
  } satisfies Partial<OrdersService>;

  beforeAll(async () => {
    app = await createHttpTestApp({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: ordersService
        }
      ]
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks customer from admin backlog endpoint", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/orders/admin")
      .set("x-test-user-id", "buyer-1")
      .set("x-test-user-role", UserRole.CUSTOMER);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(ordersService.listAdmin).not.toHaveBeenCalled();
  });

  it("allows admin to update order status through http layer", async () => {
    ordersService.updateAdminStatus.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.REFUNDED
    });

    const response = await request(app.getHttpServer())
      .patch("/api/orders/admin/order-1/status")
      .set("x-request-id", "req-admin-order")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", UserRole.ADMIN)
      .send({
        status: OrderStatus.REFUNDED
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: OrderStatus.REFUNDED
      },
      meta: {
        requestId: "req-admin-order"
      }
    });
    expect(ordersService.updateAdminStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "admin-1",
        role: UserRole.ADMIN
      }),
      "order-1",
      OrderStatus.REFUNDED
    );
  });

  it("rejects invalid admin status payload before service call", async () => {
    const response = await request(app.getHttpServer())
      .patch("/api/orders/admin/order-1/status")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", UserRole.ADMIN)
      .send({
        status: "BAD_STATUS"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(ordersService.updateAdminStatus).not.toHaveBeenCalled();
  });

  it("allows buyer to submit a return request through http layer", async () => {
    ordersService.requestReturn.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.RETURN_REQUESTED
    });

    const response = await request(app.getHttpServer())
      .post("/api/orders/order-1/return-request")
      .set("x-test-user-id", "buyer-1")
      .set("x-test-user-role", UserRole.CUSTOMER)
      .send({
        reason: "Wrong size",
        details: "Need seller support"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe(OrderStatus.RETURN_REQUESTED);
    expect(ordersService.requestReturn).toHaveBeenCalledWith("buyer-1", "order-1", {
      reason: "Wrong size",
      details: "Need seller support"
    });
  });
});
