import { Controller, Get, Param, UseGuards } from "@nestjs/common";
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
}
