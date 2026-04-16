import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { CreateShopDto } from "./dto/create-shop.dto";
import { UpdateShopDto } from "./dto/update-shop.dto";
import { UpdateShopStatusDto } from "./dto/update-shop-status.dto";
import { ShopsService } from "./shops.service";

@Controller("shops")
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getMyShop(@CurrentUser("sub") userId: string) {
    return this.shopsService.getOwnShop(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser("sub") userId: string, @Body() payload: CreateShopDto) {
    return this.shopsService.create(userId, payload);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateMyShop(@CurrentUser("sub") userId: string, @Body() payload: UpdateShopDto) {
    return this.shopsService.updateOwnShop(userId, payload);
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listAdmin() {
    return this.shopsService.listAdmin();
  }

  @Patch(":shopId/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateStatus(@Param("shopId") shopId: string, @Body() payload: UpdateShopStatusDto) {
    return this.shopsService.updateStatus(shopId, payload);
  }
}
