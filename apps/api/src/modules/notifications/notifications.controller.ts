import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listOwn(@CurrentUser("sub") userId: string) {
    return this.notificationsService.listOwn(userId);
  }

  @Patch(":notificationId/read")
  markRead(
    @CurrentUser("sub") userId: string,
    @Param("notificationId") notificationId: string
  ) {
    return this.notificationsService.markRead(userId, notificationId);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser("sub") userId: string) {
    return this.notificationsService.markAllRead(userId);
  }
}
