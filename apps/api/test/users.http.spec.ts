import type { INestApplication } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import request from "supertest";
import { UsersController } from "../src/modules/users/users.controller";
import { UsersService } from "../src/modules/users/users.service";
import { createHttpTestApp } from "./support/create-http-test-app";

describe("UsersController (http)", () => {
  let app: INestApplication;
  const usersService = {
    findById: jest.fn(),
    listAdmin: jest.fn(),
    updateAdminUser: jest.fn()
  } satisfies Partial<UsersService>;

  beforeAll(async () => {
    app = await createHttpTestApp({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService
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

  it("blocks customers from admin user listing", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/users/admin")
      .set("x-test-user-id", "buyer-1")
      .set("x-test-user-role", UserRole.CUSTOMER);

    expect(response.status).toBe(403);
    expect(usersService.listAdmin).not.toHaveBeenCalled();
  });

  it("allows admin to update user state through http layer", async () => {
    usersService.updateAdminUser.mockResolvedValue({
      id: "user-1",
      role: UserRole.SELLER,
      isActive: false
    });

    const response = await request(app.getHttpServer())
      .patch("/api/users/admin/user-1")
      .set("x-test-user-id", "admin-1")
      .set("x-test-user-role", UserRole.ADMIN)
      .send({
        role: "SELLER",
        isActive: false
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(usersService.updateAdminUser).toHaveBeenCalledWith(
      {
        sub: "admin-1",
        email: "admin-1@test.local",
        role: UserRole.ADMIN
      },
      "user-1",
      {
        role: "SELLER",
        isActive: false
      }
    );
  });
});
