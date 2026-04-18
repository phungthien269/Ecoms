import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OrderStatusHistoryService } from "./order-status-history.service";

@Module({
  imports: [PrismaModule],
  providers: [OrderStatusHistoryService],
  exports: [OrderStatusHistoryService]
})
export class OrderStatusHistoryModule {}
