import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SellerDashboardController } from "./sellerDashboard.controller";
import { SellerDashboardService } from "./sellerDashboard.service";

@Module({
  imports: [AuthModule],
  controllers: [SellerDashboardController],
  providers: [SellerDashboardService]
})
export class SellerDashboardModule {}
