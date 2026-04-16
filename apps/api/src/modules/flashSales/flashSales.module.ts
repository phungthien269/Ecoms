import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { FlashSalesController } from "./flashSales.controller";
import { FlashSalesService } from "./flashSales.service";

@Module({
  imports: [PrismaModule],
  controllers: [FlashSalesController],
  providers: [FlashSalesService],
  exports: [FlashSalesService]
})
export class FlashSalesModule {}
