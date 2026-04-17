import { IsEnum, IsOptional } from "class-validator";
import { FileAssetStatus } from "@ecoms/contracts";

export class CompleteFileAssetDto {
  @IsOptional()
  @IsEnum(FileAssetStatus)
  status?: FileAssetStatus;
}
