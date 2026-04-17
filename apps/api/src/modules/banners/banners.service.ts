import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBannerDto } from "./dto/create-banner.dto";
import { ListBannersQueryDto } from "./dto/list-banners-query.dto";
import { UpdateBannerDto } from "./dto/update-banner.dto";

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: ListBannersQueryDto) {
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        placement: query.placement ?? "HOME_HERO",
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    });

    return banners.map((banner) => this.serialize(banner));
  }

  async listAdmin() {
    const banners = await this.prisma.banner.findMany({
      where: {
        deletedAt: null
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    });

    return banners.map((banner) => this.serialize(banner));
  }

  async create(userId: string, payload: CreateBannerDto) {
    const banner = await this.prisma.banner.create({
      data: {
        title: payload.title.trim(),
        subtitle: payload.subtitle?.trim() || undefined,
        description: payload.description?.trim() || undefined,
        imageUrl: payload.imageUrl.trim(),
        mobileImageUrl: payload.mobileImageUrl?.trim() || undefined,
        linkUrl: payload.linkUrl?.trim() || undefined,
        placement: payload.placement ?? "HOME_HERO",
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
        createdByUserId: userId
      }
    });

    return this.serialize(banner);
  }

  async update(bannerId: string, payload: UpdateBannerDto) {
    const banner = await this.prisma.banner.findFirst({
      where: {
        id: bannerId,
        deletedAt: null
      }
    });

    if (!banner) {
      throw new NotFoundException("Banner not found");
    }

    const updated = await this.prisma.banner.update({
      where: { id: bannerId },
      data: {
        title: payload.title?.trim(),
        subtitle:
          payload.subtitle === undefined
            ? undefined
            : payload.subtitle.trim() || null,
        description:
          payload.description === undefined
            ? undefined
            : payload.description.trim() || null,
        imageUrl: payload.imageUrl?.trim(),
        mobileImageUrl:
          payload.mobileImageUrl === undefined
            ? undefined
            : payload.mobileImageUrl.trim() || null,
        linkUrl:
          payload.linkUrl === undefined
            ? undefined
            : payload.linkUrl.trim() || null,
        placement: payload.placement,
        sortOrder: payload.sortOrder,
        isActive: payload.isActive,
        startsAt:
          payload.startsAt === undefined
            ? undefined
            : payload.startsAt
              ? new Date(payload.startsAt)
              : null,
        endsAt:
          payload.endsAt === undefined
            ? undefined
            : payload.endsAt
              ? new Date(payload.endsAt)
              : null
      }
    });

    return this.serialize(updated);
  }

  private serialize(banner: {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    imageUrl: string;
    mobileImageUrl: string | null;
    linkUrl: string | null;
    placement: string;
    sortOrder: number;
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle,
      description: banner.description,
      imageUrl: banner.imageUrl,
      mobileImageUrl: banner.mobileImageUrl,
      linkUrl: banner.linkUrl,
      placement: banner.placement,
      sortOrder: banner.sortOrder,
      isActive: banner.isActive,
      startsAt: banner.startsAt?.toISOString() ?? null,
      endsAt: banner.endsAt?.toISOString() ?? null,
      createdAt: banner.createdAt.toISOString(),
      updatedAt: banner.updatedAt.toISOString()
    };
  }
}
