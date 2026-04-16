import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { VouchersController } from "./vouchers.controller";
import { VouchersService } from "./vouchers.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [VouchersController],
  providers: [VouchersService],
  exports: [VouchersService]
})
export class VouchersModule {}
