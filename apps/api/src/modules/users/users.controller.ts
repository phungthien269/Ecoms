import { Controller, Get } from "@nestjs/common";
import type { UserProfileEntity } from "./entities/user-profile.entity";
import { UsersService } from "./users.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UseGuards } from "@nestjs/common";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@CurrentUser("sub") userId: string): Promise<UserProfileEntity> {
    return this.usersService.findById(userId);
  }
}
