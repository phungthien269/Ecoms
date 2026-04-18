import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { UserRole } from "@ecoms/contracts";
import { ShopStatus } from "@ecoms/contracts";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthPayload } from "../auth/types/auth-payload";
import { UpdateAdminUserDto } from "./dto/update-admin-user.dto";
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

  async listAdmin() {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        }
      }
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role as UserRole,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      shop: user.shop
        ? {
            id: user.shop.id,
            name: user.shop.name,
            slug: user.shop.slug,
            status: user.shop.status
          }
        : null
    }));
  }

  async updateAdminUser(actor: AuthPayload, userId: string, payload: UpdateAdminUserDto) {
    const [actorUser, targetUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: actor.sub },
        include: {
          shop: {
            select: {
              id: true
            }
          }
        }
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          shop: {
            select: {
              id: true,
              status: true
            }
          }
        }
      })
    ]);

    if (!actorUser || actorUser.deletedAt) {
      throw new NotFoundException("Actor not found");
    }

    if (!targetUser || targetUser.deletedAt) {
      throw new NotFoundException("User not found");
    }

    if (actor.sub === userId) {
      throw new ConflictException("Use a dedicated profile flow for your own account changes");
    }

    this.assertAdminManagementAllowed(actor.role, targetUser.role as UserRole, payload.role as UserRole | undefined);

    if (
      payload.role === "CUSTOMER" &&
      targetUser.shop
    ) {
      throw new ConflictException("Cannot demote a seller while the account still owns a shop");
    }

    if (
      payload.role &&
      ["ADMIN", "SUPER_ADMIN"].includes(payload.role) &&
      targetUser.shop
    ) {
      throw new ConflictException("Cannot elevate a shop owner into admin roles without separating the shop account first");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: userId },
        data: {
          role: payload.role ?? undefined,
          isActive: payload.isActive ?? undefined
        }
      });

      if (payload.isActive === false && targetUser.shop) {
        await tx.shop.update({
          where: { id: targetUser.shop.id },
          data: {
            status: ShopStatus.SUSPENDED
          }
        });
      }

      return nextUser;
    });

    const refreshedShop = targetUser.shop
      ? await this.prisma.shop.findUnique({
          where: { id: targetUser.shop.id },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        })
      : null;

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      phoneNumber: updated.phoneNumber,
      role: updated.role as UserRole,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      shop: refreshedShop
    };
  }

  private assertAdminManagementAllowed(
    actorRole: UserRole,
    targetRole: UserRole,
    nextRole?: UserRole
  ) {
    if (actorRole !== "SUPER_ADMIN" && ["ADMIN", "SUPER_ADMIN"].includes(targetRole)) {
      throw new ForbiddenException("Only super admins can manage admin-level accounts");
    }

    if (actorRole !== "SUPER_ADMIN" && nextRole && ["ADMIN", "SUPER_ADMIN"].includes(nextRole)) {
      throw new ForbiddenException("Only super admins can assign admin-level roles");
    }
  }
}
