import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AddressesController } from "../src/modules/addresses/addresses.controller";
import { AddressesService } from "../src/modules/addresses/addresses.service";
import { createHttpTestApp } from "./support/create-http-test-app";

describe("AddressesController (http)", () => {
  let app: INestApplication;
  const addressesService = {
    listOwn: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setDefault: jest.fn(),
    remove: jest.fn()
  } satisfies Partial<AddressesService>;

  beforeAll(async () => {
    app = await createHttpTestApp({
      controllers: [AddressesController],
      providers: [
        {
          provide: AddressesService,
          useValue: addressesService
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

  it("lists current user addresses", async () => {
    addressesService.listOwn.mockResolvedValue([
      {
        id: "addr-1",
        label: "Home",
        recipientName: "Demo Buyer",
        phoneNumber: "0900000000",
        addressLine1: "123 Demo Street",
        addressLine2: null,
        ward: null,
        district: "District 1",
        province: "Ho Chi Minh City",
        regionCode: "HCM",
        isDefault: true,
        createdAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z"
      }
    ]);

    const response = await request(app.getHttpServer())
      .get("/api/addresses")
      .set("x-test-user-id", "buyer-1");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(addressesService.listOwn).toHaveBeenCalledWith("buyer-1");
  });

  it("validates create payload", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/addresses")
      .set("x-test-user-id", "buyer-1")
      .send({
        label: "",
        recipientName: "A",
        phoneNumber: "123"
      });

    expect(response.status).toBe(400);
    expect(addressesService.create).not.toHaveBeenCalled();
  });
});
