import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReplyReviewDto } from "./dto/reply-review.dto";
import { ReviewsService } from "./reviews.service";

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get("product/:productIdOrSlug")
  listForProduct(@Param("productIdOrSlug") productIdOrSlug: string) {
    return this.reviewsService.listForProduct(productIdOrSlug);
  }

  @Get("me/eligible")
  @UseGuards(JwtAuthGuard)
  listEligible(@CurrentUser("sub") userId: string) {
    return this.reviewsService.listEligible(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser("sub") userId: string, @Body() payload: CreateReviewDto) {
    return this.reviewsService.create(userId, payload);
  }

  @Patch(":reviewId/reply")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  reply(
    @CurrentUser("sub") userId: string,
    @Param("reviewId") reviewId: string,
    @Body() payload: ReplyReviewDto
  ) {
    return this.reviewsService.reply(userId, reviewId, payload.reply);
  }
}
