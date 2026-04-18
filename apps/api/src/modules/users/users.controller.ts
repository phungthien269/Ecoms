import { Body, Controller, Get, Patch, Param, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import type { UserProfileEntity } from "./entities/user-profile.entity";
import { UsersService } from "./users.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import type { AuthPayload } from "../auth/types/auth-payload";
import { ListAdminUsersDto } from "./dto/list-admin-users.dto";
import { UpdateAdminUserDto } from "./dto/update-admin-user.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@CurrentUser("sub") userId: string): Promise<UserProfileEntity> {
    return this.usersService.findById(userId);
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listAdmin(@Query() query: ListAdminUsersDto) {
    return this.usersService.listAdmin(query);
  }

  @Patch("admin/:userId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateAdminUser(
    @CurrentUser() actor: AuthPayload,
    @Param("userId") userId: string,
    @Body() payload: UpdateAdminUserDto
  ) {
    return this.usersService.updateAdminUser(actor, userId, payload);
  }
}
