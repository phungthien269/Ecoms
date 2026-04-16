import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.brand.findMany({
      orderBy: [{ name: "asc" }]
    });
  }

  async create(payload: CreateBrandDto) {
    const slug = await this.generateUniqueSlug(payload.name);
    return this.prisma.brand.create({
      data: {
        name: payload.name,
        slug,
        description: payload.description,
        logoUrl: payload.logoUrl
      }
    });
  }

  async update(brandId: string, payload: UpdateBrandDto) {
    await this.ensureBrandExists(brandId);

    return this.prisma.brand.update({
      where: { id: brandId },
      data: {
        name: payload.name,
        slug: payload.name
          ? await this.generateUniqueSlug(payload.name, brandId)
          : undefined,
        description: payload.description,
        logoUrl: payload.logoUrl
      }
    });
  }

  async remove(brandId: string) {
    await this.ensureBrandExists(brandId);
    await this.prisma.brand.delete({
      where: { id: brandId }
    });
    return { deleted: true };
  }

  private async ensureBrandExists(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId }
    });

    if (!brand) {
      throw new NotFoundException("Brand not found");
    }

    return brand;
  }

  private async generateUniqueSlug(name: string, brandId?: string) {
    const baseSlug = slugify(name);
    let candidate = baseSlug;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.brand.findFirst({
        where: {
          slug: candidate,
          ...(brandId
            ? {
                NOT: {
                  id: brandId
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
