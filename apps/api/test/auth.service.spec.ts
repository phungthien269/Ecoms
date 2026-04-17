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
      create: jest.fn(),
      update: jest.fn()
    }
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue("signed-token"),
    verifyAsync: jest.fn()
  } as unknown as JwtService;
  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === "FRONTEND_URL") {
        return "http://localhost:3000";
      }

      return fallback;
    })
  };
  const mailerService = {
    sendSafely: jest.fn()
  };

  const service = new AuthService(
    prisma as never,
    jwtService,
    configService as never,
    mailerService as never
  );

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
    expect(mailerService.sendSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        tags: ["signup"]
      })
    );
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

  it("creates a customer account for a verified Google profile", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValue({
      id: "user-google-1",
      email: "buyer@example.com",
      googleSubject: "google-subject-1",
      fullName: "Google Buyer",
      phoneNumber: null,
      role: UserRole.CUSTOMER,
      isActive: true,
      deletedAt: null
    });

    const result = await service.loginWithGoogleProfile({
      subject: "google-subject-1",
      email: "buyer@example.com",
      fullName: "Google Buyer",
      emailVerified: true
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "buyer@example.com",
        googleSubject: "google-subject-1",
        fullName: "Google Buyer",
        role: UserRole.CUSTOMER
      }
    });
    expect(mailerService.sendSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        tags: ["signup"]
      })
    );
    expect(result.accessToken).toBe("signed-token");
  });

  it("links a verified Google profile to an existing email", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "user-existing-1",
        email: "seller@example.com",
        googleSubject: null,
        fullName: "Seller One",
        phoneNumber: null,
        role: UserRole.SELLER,
        isActive: true,
        deletedAt: null
      });
    prisma.user.update.mockResolvedValue({
      id: "user-existing-1",
      email: "seller@example.com",
      googleSubject: "google-subject-2",
      fullName: "Seller One",
      phoneNumber: null,
      role: UserRole.SELLER,
      isActive: true,
      deletedAt: null
    });

    const result = await service.loginWithGoogleProfile({
      subject: "google-subject-2",
      email: "seller@example.com",
      fullName: "Seller One",
      emailVerified: true
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-existing-1" },
      data: {
        googleSubject: "google-subject-2"
      }
    });
    expect(result.user.role).toBe(UserRole.SELLER);
  });
});
