import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListAdminProviderEventsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsIn(["mock_gateway", "demo_gateway"])
  providerMode?: "mock_gateway" | "demo_gateway";

  @IsOptional()
  @IsIn(["processed", "ignored"])
  callbackOutcome?: "processed" | "ignored";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 12;
}
