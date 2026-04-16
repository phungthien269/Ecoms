import { IsEnum } from "class-validator";
import { ShopStatus } from "@ecoms/contracts";

export class UpdateShopStatusDto {
  @IsEnum(ShopStatus)
  status!: ShopStatus;
}
