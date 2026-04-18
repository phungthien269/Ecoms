import { NotFoundException } from "@nestjs/common";
import { AddressesService } from "../src/modules/addresses/addresses.service";

describe("AddressesService", () => {
  const prisma = {
    userAddress: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    $transaction: jest.fn()
  };

  const service = new AddressesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma)
    );
  });

  it("creates the first address as default", async () => {
    prisma.userAddress.count.mockResolvedValue(0);
    prisma.userAddress.create.mockResolvedValue({
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
      createdAt: new Date("2026-04-18T00:00:00.000Z"),
      updatedAt: new Date("2026-04-18T00:00:00.000Z")
    });

    const result = await service.create("user-1", {
      label: "Home",
      recipientName: "Demo Buyer",
      phoneNumber: "0900000000",
      addressLine1: "123 Demo Street",
      district: "District 1",
      province: "Ho Chi Minh City",
      regionCode: "HCM"
    });

    expect(prisma.userAddress.updateMany).toHaveBeenCalled();
    expect(result.isDefault).toBe(true);
  });

  it("sets another address as default", async () => {
    prisma.userAddress.findFirst.mockResolvedValue({
      id: "addr-2",
      userId: "user-1",
      isDefault: false,
      deletedAt: null
    });
    prisma.userAddress.update.mockResolvedValue({
      id: "addr-2",
      label: "Office",
      recipientName: "Demo Buyer",
      phoneNumber: "0900000001",
      addressLine1: "456 Work Ave",
      addressLine2: null,
      ward: null,
      district: "District 3",
      province: "Ho Chi Minh City",
      regionCode: "HCM",
      isDefault: true,
      createdAt: new Date("2026-04-18T00:00:00.000Z"),
      updatedAt: new Date("2026-04-18T00:00:00.000Z")
    });

    const result = await service.setDefault("user-1", "addr-2");

    expect(prisma.userAddress.updateMany).toHaveBeenCalled();
    expect(result.isDefault).toBe(true);
  });

  it("promotes another address when deleting current default", async () => {
    prisma.userAddress.findFirst
      .mockResolvedValueOnce({
        id: "addr-1",
        userId: "user-1",
        isDefault: true,
        deletedAt: null
      })
      .mockResolvedValueOnce({
        id: "addr-2",
        userId: "user-1",
        isDefault: false,
        deletedAt: null
      });

    await service.remove("user-1", "addr-1");

    expect(prisma.userAddress.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "addr-1" }
      })
    );
    expect(prisma.userAddress.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "addr-2" }
      })
    );
  });

  it("throws when address does not belong to user", async () => {
    prisma.userAddress.findFirst.mockResolvedValue(null);

    await expect(service.setDefault("user-1", "missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
