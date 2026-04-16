import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminDashboardController } from "./adminDashboard.controller";
import { AdminDashboardService } from "./adminDashboard.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService]
})
export class AdminDashboardModule {}
