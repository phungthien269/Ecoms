import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { Post } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrdersService } from "./orders.service";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  listOwn(@CurrentUser("sub") userId: string) {
    return this.ordersService.listOwn(userId);
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
}
