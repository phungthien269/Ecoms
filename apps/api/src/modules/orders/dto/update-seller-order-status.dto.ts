import { OrderStatus } from "@ecoms/contracts";
import { IsEnum } from "class-validator";

export class UpdateSellerOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
