import type { INestApplication } from "@nestjs/common";
import { PaymentMethod } from "@ecoms/contracts";
import request from "supertest";
import { CheckoutController } from "../src/modules/checkout/checkout.controller";
import { CheckoutService } from "../src/modules/checkout/checkout.service";
import { createHttpTestApp } from "./support/create-http-test-app";

describe("CheckoutController (http)", () => {
  let app: INestApplication;
  const checkoutService = {
    preview: jest.fn(),
    placeOrder: jest.fn()
  } satisfies Pick<CheckoutService, "preview" | "placeOrder">;

  beforeAll(async () => {
    app = await createHttpTestApp({
      controllers: [CheckoutController],
      providers: [
        {
          provide: CheckoutService,
          useValue: checkoutService
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

  it("wraps preview response and preserves request id", async () => {
    checkoutService.preview.mockResolvedValue({
      items: [],
      totals: {
        subtotal: 120_000,
        shippingFee: 18_000,
        discountTotal: 10_000,
        grandTotal: 128_000
      }
    });

    const response = await request(app.getHttpServer())
      .post("/api/checkout/preview")
      .set("x-request-id", "req-checkout-preview")
      .set("x-test-user-id", "buyer-1")
      .send({
        shippingAddress: {
          recipientName: "Affaan",
          phoneNumber: "0900000001",
          addressLine1: "123 Demo Street",
          ward: "Ward 1",
          district: "District 1",
          province: "Ho Chi Minh",
          regionCode: "HCM"
        },
        paymentMethod: PaymentMethod.COD
      });

    expect(response.status).toBe(201);
    expect(response.headers["x-request-id"]).toBe("req-checkout-preview");
    expect(response.body).toMatchObject({
      success: true,
      data: {
        totals: {
          grandTotal: 128_000
        }
      },
      meta: {
        requestId: "req-checkout-preview"
      }
    });
    expect(checkoutService.preview).toHaveBeenCalledWith(
      "buyer-1",
      expect.objectContaining({
        paymentMethod: PaymentMethod.COD
      })
    );
  });

  it("returns structured validation errors for invalid checkout payload", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/checkout/preview")
      .set("x-request-id", "req-checkout-invalid")
      .set("x-test-user-id", "buyer-1")
      .send({
        shippingAddress: {
          recipientName: "Affaan"
        },
        paymentMethod: "INVALID"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("HTTP_ERROR");
    expect(response.body.path).toBe("/api/checkout/preview");
    expect(response.body.requestId).toBe("req-checkout-invalid");
    expect(checkoutService.preview).not.toHaveBeenCalled();
  });
});
