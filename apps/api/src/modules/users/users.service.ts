import { Injectable, NotFoundException } from "@nestjs/common";
import type { UserRole } from "@ecoms/contracts";
import { PrismaService } from "../prisma/prisma.service";
import type { UserProfileEntity } from "./entities/user-profile.entity";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<UserProfileEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role as UserRole
    };
  }
}
