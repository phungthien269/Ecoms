import { Injectable, NotFoundException } from "@nestjs/common";
import type { SavedAddressSummary } from "@ecoms/contracts";
import type { Prisma, UserAddress } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAddressDto } from "./dto/create-address.dto";
import { UpdateAddressDto } from "./dto/update-address.dto";

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async listOwn(userId: string): Promise<SavedAddressSummary[]> {
    const addresses = await this.prisma.userAddress.findMany({
      where: {
        userId,
        deletedAt: null
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    });

    return addresses.map((address) => this.serialize(address));
  }

  async create(userId: string, payload: CreateAddressDto): Promise<SavedAddressSummary> {
    return this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.userAddress.count({
        where: {
          userId,
          deletedAt: null
        }
      });
      const shouldBeDefault = payload.isDefault === true || existingCount === 0;

      if (shouldBeDefault) {
        await tx.userAddress.updateMany({
          where: {
            userId,
            deletedAt: null
          },
          data: {
            isDefault: false
          }
        });
      }

      const created = await tx.userAddress.create({
        data: {
          userId,
          label: payload.label.trim(),
          recipientName: payload.recipientName.trim(),
          phoneNumber: payload.phoneNumber.trim(),
          addressLine1: payload.addressLine1.trim(),
          addressLine2: payload.addressLine2?.trim() || null,
          ward: payload.ward?.trim() || null,
          district: payload.district.trim(),
          province: payload.province.trim(),
          regionCode: payload.regionCode,
          isDefault: shouldBeDefault
        }
      });

      return this.serialize(created);
    });
  }

  async update(userId: string, addressId: string, payload: UpdateAddressDto): Promise<SavedAddressSummary> {
    await this.requireOwnedAddress(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      if (payload.isDefault === true) {
        await tx.userAddress.updateMany({
          where: {
            userId,
            deletedAt: null
          },
          data: {
            isDefault: false
          }
        });
      }

      const updated = await tx.userAddress.update({
        where: {
          id: addressId
        },
        data: {
          ...(payload.label !== undefined ? { label: payload.label.trim() } : {}),
          ...(payload.recipientName !== undefined
            ? { recipientName: payload.recipientName.trim() }
            : {}),
          ...(payload.phoneNumber !== undefined
            ? { phoneNumber: payload.phoneNumber.trim() }
            : {}),
          ...(payload.addressLine1 !== undefined
            ? { addressLine1: payload.addressLine1.trim() }
            : {}),
          ...(payload.addressLine2 !== undefined
            ? { addressLine2: payload.addressLine2.trim() || null }
            : {}),
          ...(payload.ward !== undefined ? { ward: payload.ward.trim() || null } : {}),
          ...(payload.district !== undefined ? { district: payload.district.trim() } : {}),
          ...(payload.province !== undefined ? { province: payload.province.trim() } : {}),
          ...(payload.regionCode !== undefined ? { regionCode: payload.regionCode } : {}),
          ...(payload.isDefault === true ? { isDefault: true } : {})
        }
      });

      return this.serialize(updated);
    });
  }

  async setDefault(userId: string, addressId: string): Promise<SavedAddressSummary> {
    await this.requireOwnedAddress(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      await tx.userAddress.updateMany({
        where: {
          userId,
          deletedAt: null
        },
        data: {
          isDefault: false
        }
      });

      const updated = await tx.userAddress.update({
        where: {
          id: addressId
        },
        data: {
          isDefault: true
        }
      });

      return this.serialize(updated);
    });
  }

  async remove(userId: string, addressId: string) {
    const address = await this.requireOwnedAddress(userId, addressId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userAddress.update({
        where: {
          id: addressId
        },
        data: {
          deletedAt: new Date(),
          isDefault: false
        }
      });

      if (!address.isDefault) {
        return;
      }

      const nextDefault = await tx.userAddress.findFirst({
        where: {
          userId,
          deletedAt: null,
          id: {
            not: addressId
          }
        },
        orderBy: [{ updatedAt: "desc" }]
      });

      if (nextDefault) {
        await tx.userAddress.update({
          where: {
            id: nextDefault.id
          },
          data: {
            isDefault: true
          }
        });
      }
    });

    return {
      success: true
    };
  }

  private async requireOwnedAddress(userId: string, addressId: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: {
        id: addressId,
        userId,
        deletedAt: null
      }
    });

    if (!address) {
      throw new NotFoundException("Address not found");
    }

    return address;
  }

  private serialize(address: UserAddress): SavedAddressSummary {
    return {
      id: address.id,
      label: address.label,
      recipientName: address.recipientName,
      phoneNumber: address.phoneNumber,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      ward: address.ward,
      district: address.district,
      province: address.province,
      regionCode: address.regionCode,
      isDefault: address.isDefault,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString()
    };
  }
}
