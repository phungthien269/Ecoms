import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTree(): Promise<CategoryTreeNode[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ name: "asc" }]
    });

    const nodes = new Map<string, CategoryTreeNode>();
    for (const category of categories) {
      nodes.set(category.id, {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parentId,
        children: []
      });
    }

    const roots: CategoryTreeNode[] = [];
    for (const node of nodes.values()) {
      if (node.parentId) {
        nodes.get(node.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async listFlat() {
    return this.prisma.category.findMany({
      orderBy: [{ createdAt: "desc" }]
    });
  }

  async create(payload: CreateCategoryDto) {
    if (payload.parentId) {
      await this.ensureCategoryExists(payload.parentId);
    }

    const slug = await this.generateUniqueSlug(payload.name);

    return this.prisma.category.create({
      data: {
        name: payload.name,
        slug,
        description: payload.description,
        parentId: payload.parentId
      }
    });
  }

  async update(categoryId: string, payload: UpdateCategoryDto) {
    await this.ensureCategoryExists(categoryId);

    if (payload.parentId) {
      if (payload.parentId === categoryId) {
        throw new ConflictException("Category cannot be its own parent");
      }

      await this.ensureCategoryExists(payload.parentId);
    }

    const data: {
      name?: string;
      slug?: string;
      description?: string;
      parentId?: string | null;
    } = {};

    if (payload.name) {
      data.name = payload.name;
      data.slug = await this.generateUniqueSlug(payload.name, categoryId);
    }
    if (payload.description !== undefined) {
      data.description = payload.description;
    }
    if (payload.parentId !== undefined) {
      data.parentId = payload.parentId;
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data
    });
  }

  async remove(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { children: true, products: true }
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    if (category.children.length > 0 || category.products.length > 0) {
      throw new ConflictException(
        "Category cannot be deleted while it has children or products"
      );
    }

    await this.prisma.category.delete({
      where: { id: categoryId }
    });

    return { deleted: true };
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return category;
  }

  private async generateUniqueSlug(name: string, categoryId?: string) {
    const baseSlug = slugify(name);
    let candidate = baseSlug;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.category.findFirst({
        where: {
          slug: candidate,
          ...(categoryId
            ? {
                NOT: {
                  id: categoryId
                }
              }
            : {})
        }
      });

      if (!existing) {
        return candidate;
      }

      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }
  }
}
