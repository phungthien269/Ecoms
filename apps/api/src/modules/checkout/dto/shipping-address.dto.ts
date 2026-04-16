import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

const regionCodes = ["HN", "HCM", "CENTRAL", "OTHER"] as const;

export class ShippingAddressDto {
  @IsString()
  @MinLength(2)
  recipientName!: string;

  @IsString()
  @MinLength(8)
  phoneNumber!: string;

  @IsString()
  @MinLength(5)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsString()
  @MinLength(2)
  district!: string;

  @IsString()
  @MinLength(2)
  province!: string;

  @IsString()
  @IsIn(regionCodes)
  regionCode!: (typeof regionCodes)[number];
}
