import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const regionCodes = ["HN", "HCM", "CENTRAL", "OTHER"] as const;

export class CreateAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label!: string;

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
  @MaxLength(120)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
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

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
