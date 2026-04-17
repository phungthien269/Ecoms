import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RateLimit } from "../rateLimit/rate-limit.decorator";
import { RateLimitGuard } from "../rateLimit/rate-limit.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { CompleteFileAssetDto } from "./dto/complete-file-asset.dto";
import { CreateUploadIntentDto } from "./dto/create-upload-intent.dto";
import { FilesService } from "./files.service";

@Controller("files")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get("me")
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listOwn(@CurrentUser("sub") userId: string) {
    return this.filesService.listOwn(userId);
  }

  @Post("upload-intent")
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: "files.upload_intent"
  })
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createUploadIntent(@CurrentUser("sub") userId: string, @Body() payload: CreateUploadIntentDto) {
    return this.filesService.createUploadIntent(userId, payload);
  }

  @Patch(":fileAssetId/complete")
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  complete(
    @CurrentUser("sub") userId: string,
    @Param("fileAssetId") fileAssetId: string,
    @Body() payload: CompleteFileAssetDto
  ) {
    return this.filesService.complete(userId, fileAssetId, payload.status);
  }
}
