import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { BrandsService } from "./brands.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

@Controller("brands")
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  list() {
    return this.brandsService.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() payload: CreateBrandDto) {
    return this.brandsService.create(payload);
  }

  @Patch(":brandId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(@Param("brandId") brandId: string, @Body() payload: UpdateBrandDto) {
    return this.brandsService.update(brandId, payload);
  }

  @Delete(":brandId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param("brandId") brandId: string) {
    return this.brandsService.remove(brandId);
  }
}
