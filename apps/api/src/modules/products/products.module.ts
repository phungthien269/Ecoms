import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../auditLogs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { FilesModule } from "../files/files.module";
import { FlashSalesModule } from "../flashSales/flashSales.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [AuthModule, FlashSalesModule, FilesModule, AuditLogsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService]
})
export class ProductsModule {}
