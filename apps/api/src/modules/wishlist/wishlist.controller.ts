import { Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { WishlistService } from "./wishlist.service";

@Controller("wishlist")
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  list(@CurrentUser("sub") userId: string) {
    return this.wishlistService.list(userId);
  }

  @Post(":productId")
  add(@CurrentUser("sub") userId: string, @Param("productId") productId: string) {
    return this.wishlistService.add(userId, productId);
  }

  @Delete(":productId")
  remove(@CurrentUser("sub") userId: string, @Param("productId") productId: string) {
    return this.wishlistService.remove(userId, productId);
  }
}
