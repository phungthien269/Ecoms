import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CheckoutPreviewDto } from "./dto/checkout-preview.dto";
import { CheckoutService } from "./checkout.service";

@Controller("checkout")
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post("preview")
  preview(@CurrentUser("sub") userId: string, @Body() payload: CheckoutPreviewDto) {
    return this.checkoutService.preview(userId, payload);
  }

  @Post("place-order")
  placeOrder(@CurrentUser("sub") userId: string, @Body() payload: CheckoutPreviewDto) {
    return this.checkoutService.placeOrder(userId, payload);
  }
}
