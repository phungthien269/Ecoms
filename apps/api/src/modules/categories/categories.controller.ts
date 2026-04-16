import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Roles } from "../rbac/decorators/roles.decorator";
import { RolesGuard } from "../rbac/guards/roles.guard";
import { CategoriesService, type CategoryTreeNode } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  listTree(): Promise<CategoryTreeNode[]> {
    return this.categoriesService.listTree();
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  listFlat() {
    return this.categoriesService.listFlat();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() payload: CreateCategoryDto) {
    return this.categoriesService.create(payload);
  }

  @Patch(":categoryId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param("categoryId") categoryId: string,
    @Body() payload: UpdateCategoryDto
  ) {
    return this.categoriesService.update(categoryId, payload);
  }

  @Delete(":categoryId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param("categoryId") categoryId: string) {
    return this.categoriesService.remove(categoryId);
  }
}
