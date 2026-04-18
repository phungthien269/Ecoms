import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import type { AuthPayload } from "../auth/types/auth-payload";
import { CreateProductDto } from "./dto/create-product.dto";
import { ListAdminProductsDto } from "./dto/list-admin-products.dto";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { UpdateProductStatusDto } from "./dto/update-product-status.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  listPublic(@Query() query: ListProductsQueryDto) {
    return this.productsService.listPublic(query);
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listAdmin(@Query() query: ListAdminProductsDto) {
    return this.productsService.listAdmin(query);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listOwn(@CurrentUser("sub") userId: string) {
    return this.productsService.listOwnProducts(userId);
  }

  @Get(":productIdOrSlug")
  getPublicDetail(@Param("productIdOrSlug") productIdOrSlug: string) {
    return this.productsService.getPublicDetail(productIdOrSlug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@CurrentUser("sub") userId: string, @Body() payload: CreateProductDto) {
    return this.productsService.create(userId, payload);
  }

  @Patch(":productId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @CurrentUser("sub") userId: string,
    @Param("productId") productId: string,
    @Body() payload: UpdateProductDto
  ) {
    return this.productsService.update(userId, productId, payload);
  }

  @Delete(":productId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@CurrentUser("sub") userId: string, @Param("productId") productId: string) {
    return this.productsService.remove(userId, productId);
  }

  @Patch(":productId/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateStatus(
    @CurrentUser() actor: AuthPayload,
    @Param("productId") productId: string,
    @Body() payload: UpdateProductStatusDto
  ) {
    return this.productsService.updateStatus(actor, productId, payload);
  }
}
