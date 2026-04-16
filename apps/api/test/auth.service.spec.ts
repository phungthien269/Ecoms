import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@ecoms/contracts";
import { compare } from "bcryptjs";
import { AuthService } from "../src/modules/auth/auth.service";

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue("hashed-password")
}));

describe("AuthService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn()
    }
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue("signed-token"),
    verifyAsync: jest.fn()
  } as unknown as JwtService;

  const service = new AuthService(prisma as never, jwtService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers a new customer and returns an access token", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "buyer@example.com",
      fullName: "Buyer One",
      phoneNumber: "0123456789",
      role: UserRole.CUSTOMER
    });

    const result = await service.register({
      email: "buyer@example.com",
      password: "Password123!",
      fullName: "Buyer One",
      phoneNumber: "0123456789"
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "buyer@example.com",
        fullName: "Buyer One",
        role: UserRole.CUSTOMER
      })
    });
    expect(result).toEqual({
      user: {
        id: "user-1",
        email: "buyer@example.com",
        fullName: "Buyer One",
        phoneNumber: "0123456789",
        role: UserRole.CUSTOMER
      },
      accessToken: "signed-token"
    });
  });

  it("rejects registration for an existing active email", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      deletedAt: null
    });

    await expect(
      service.register({
        email: "buyer@example.com",
        password: "Password123!",
        fullName: "Buyer One",
        phoneNumber: undefined
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects login for an invalid password", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-3",
      email: "buyer@example.com",
      fullName: "Buyer One",
      phoneNumber: null,
      role: UserRole.CUSTOMER,
      passwordHash: "stored-hash",
      deletedAt: null
    });
    (compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: "buyer@example.com",
        password: "wrong-password"
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
