import { NotFoundException } from "@nestjs/common";
import { BannersService } from "../src/modules/banners/banners.service";

describe("BannersService", () => {
  const prisma = {
    banner: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    }
  };

  const service = new BannersService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists public active banners ordered for storefront", async () => {
    prisma.banner.findMany.mockResolvedValue([
      {
        id: "banner-1",
        title: "Mega Sale",
        subtitle: "Weekend drop",
        description: "Save more today",
        imageUrl: "https://cdn.example.com/banner-1.jpg",
        mobileImageUrl: null,
        linkUrl: "/products",
        placement: "HOME_HERO",
        sortOrder: 0,
        isActive: true,
        startsAt: null,
        endsAt: null,
        createdAt: new Date("2026-04-18T10:00:00.000Z"),
        updatedAt: new Date("2026-04-18T10:00:00.000Z")
      }
    ]);

    const result = await service.listPublic({});
    expect(result).toHaveLength(1);
    expect(prisma.banner.findMany).toHaveBeenCalled();
    expect(result[0]?.placement).toBe("HOME_HERO");
  });

  it("creates a banner for admin management", async () => {
    prisma.banner.create.mockResolvedValue({
      id: "banner-1",
      title: "Mega Sale",
      subtitle: null,
      description: null,
      imageUrl: "https://cdn.example.com/banner-1.jpg",
      mobileImageUrl: null,
      linkUrl: null,
      placement: "HOME_HERO",
      sortOrder: 0,
      isActive: true,
      startsAt: null,
      endsAt: null,
      createdAt: new Date("2026-04-18T10:00:00.000Z"),
      updatedAt: new Date("2026-04-18T10:00:00.000Z")
    });

    const result = await service.create("admin-1", {
      title: "Mega Sale",
      imageUrl: "https://cdn.example.com/banner-1.jpg"
    });

    expect(result.title).toBe("Mega Sale");
    expect(prisma.banner.create).toHaveBeenCalled();
  });

  it("fails when updating a missing banner", async () => {
    prisma.banner.findFirst.mockResolvedValue(null);

    await expect(service.update("missing-banner", { isActive: false })).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
