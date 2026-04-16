import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { UpdateSellerOrderStatusDto } from "./dto/update-seller-order-status.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  listOwn(@CurrentUser("sub") userId: string) {
    return this.ordersService.listOwn(userId);
  }

  @Get("seller/me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listSellerOrders(@CurrentUser("sub") userId: string) {
    return this.ordersService.listSellerOrders(userId);
  }

  @Get("seller/me/:orderId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getSellerOrderDetail(@CurrentUser("sub") userId: string, @Param("orderId") orderId: string) {
    return this.ordersService.getSellerOrderDetail(userId, orderId);
  }

  @Get(":orderId")
  getOwnDetail(@CurrentUser("sub") userId: string, @Param("orderId") orderId: string) {
    return this.ordersService.getOwnDetail(userId, orderId);
  }

  @Post(":orderId/cancel")
  cancel(@CurrentUser("sub") userId: string, @Param("orderId") orderId: string) {
    return this.ordersService.cancel(userId, orderId);
  }

  @Post(":orderId/complete")
  complete(@CurrentUser("sub") userId: string, @Param("orderId") orderId: string) {
    return this.ordersService.complete(userId, orderId);
  }

  @Patch("seller/me/:orderId/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateSellerStatus(
    @CurrentUser("sub") userId: string,
    @Param("orderId") orderId: string,
    @Body() payload: UpdateSellerOrderStatusDto
  ) {
    return this.ordersService.updateSellerStatus(userId, orderId, payload.status);
  }
}
