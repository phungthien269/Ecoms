import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { SellerDashboardService } from "./sellerDashboard.service";

@Controller("seller/dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class SellerDashboardController {
  constructor(private readonly sellerDashboardService: SellerDashboardService) {}

  @Get()
  getSummary(@CurrentUser("sub") userId: string) {
    return this.sellerDashboardService.getSummary(userId);
  }
}
