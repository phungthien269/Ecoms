import { IsIn, IsOptional } from "class-validator";

const BANNER_PLACEMENTS = ["HOME_HERO"] as const;

export class ListBannersQueryDto {
  @IsOptional()
  @IsIn(BANNER_PLACEMENTS)
  placement?: "HOME_HERO";
}
