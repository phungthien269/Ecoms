import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { UserRole, VoucherScope } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { CreateAdminVoucherDto } from "./dto/create-admin-voucher.dto";
import { CreateShopVoucherDto } from "./dto/create-shop-voucher.dto";
import { VouchersService } from "./vouchers.service";

@Controller("vouchers")
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listAdmin() {
    return this.vouchersService.listAdmin();
  }

  @Post("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createAdminVoucher(
    @CurrentUser("sub") userId: string,
    @Body() payload: CreateAdminVoucherDto
  ) {
    return this.vouchersService.createAdminVoucher(userId, payload);
  }

  @Get("shop/me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  listSeller(@CurrentUser("sub") userId: string) {
    return this.vouchersService.listSeller(userId);
  }

  @Post("shop/me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  createSellerVoucher(
    @CurrentUser("sub") userId: string,
    @Body() payload: CreateShopVoucherDto
  ) {
    return this.vouchersService.createSellerVoucher(userId, payload);
  }

  @Get("checkout/platform")
  @UseGuards(JwtAuthGuard)
  listCheckoutPlatformVouchers() {
    return this.vouchersService.listCheckoutOptions(VoucherScope.PLATFORM);
  }

  @Get("checkout/freeship")
  @UseGuards(JwtAuthGuard)
  listCheckoutFreeshipVouchers() {
    return this.vouchersService.listCheckoutOptions(VoucherScope.FREESHIP);
  }
}
