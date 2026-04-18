import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthPayload } from "../auth/types/auth-payload";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { UpdateSystemSettingDto } from "./dto/update-system-setting.dto";
import { SystemSettingsService } from "./system-settings.service";

@Controller("system-settings")
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get("public")
  listPublic() {
    return this.systemSettingsService.getPublicSummary();
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  listAdmin() {
    return this.systemSettingsService.listAdmin();
  }

  @Patch("admin/:key")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @CurrentUser() actor: AuthPayload,
    @Param("key") key: string,
    @Body() payload: UpdateSystemSettingDto
  ) {
    return this.systemSettingsService.update(actor, key, payload.value);
  }
}
