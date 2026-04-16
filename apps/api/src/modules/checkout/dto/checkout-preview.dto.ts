import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";
import { PaymentMethod } from "@ecoms/contracts";
import { ShippingAddressDto } from "./shipping-address.dto";

export class CheckoutPreviewDto {
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;
}
