import { IsEnum } from "class-validator";
import { ProductStatus } from "@ecoms/contracts";

export class UpdateProductStatusDto {
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}
