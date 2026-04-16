import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { PaymentMethod } from "@ecoms/contracts";
import { ShippingAddressDto } from "./shipping-address.dto";

class CheckoutShopVoucherDto {
  @IsString()
  shopId!: string;

  @IsString()
  code!: string;
}

class CheckoutVoucherSelectionDto {
  @IsOptional()
  @IsString()
  platformCode?: string;

  @IsOptional()
  @IsString()
  freeshipCode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutShopVoucherDto)
  shopCodes?: CheckoutShopVoucherDto[];
}

export class CheckoutPreviewDto {
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutVoucherSelectionDto)
  vouchers?: CheckoutVoucherSelectionDto;
}
