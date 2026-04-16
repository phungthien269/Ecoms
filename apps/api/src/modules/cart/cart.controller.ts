import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";
import { CartService } from "./cart.service";

@Controller("cart")
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCurrentCart(@CurrentUser("sub") userId: string) {
    return this.cartService.getCurrentCart(userId);
  }

  @Post("items")
  addItem(@CurrentUser("sub") userId: string, @Body() payload: AddCartItemDto) {
    return this.cartService.addItem(userId, payload);
  }

  @Patch("items/:cartItemId")
  updateItem(
    @CurrentUser("sub") userId: string,
    @Param("cartItemId") cartItemId: string,
    @Body() payload: UpdateCartItemDto
  ) {
    return this.cartService.updateItem(userId, cartItemId, payload);
  }

  @Delete("items/:cartItemId")
  removeItem(@CurrentUser("sub") userId: string, @Param("cartItemId") cartItemId: string) {
    return this.cartService.removeItem(userId, cartItemId);
  }

  @Delete()
  clear(@CurrentUser("sub") userId: string) {
    return this.cartService.clear(userId);
  }
}
