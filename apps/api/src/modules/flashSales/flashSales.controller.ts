import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { CreateFlashSaleDto } from "./dto/create-flash-sale.dto";
import { FlashSalesService } from "./flashSales.service";

@Controller("flash-sales")
export class FlashSalesController {
  constructor(private readonly flashSalesService: FlashSalesService) {}

  @Get("active")
  listActive() {
    return this.flashSalesService.listActive();
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listAdmin() {
    return this.flashSalesService.listAdmin();
  }

  @Post("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() payload: CreateFlashSaleDto) {
    return this.flashSalesService.create(payload);
  }
}
