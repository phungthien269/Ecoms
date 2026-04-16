const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function upsertUser({ email, fullName, role, passwordHash }) {
  return prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      role,
      passwordHash
    },
    create: {
      email,
      fullName,
      role,
      passwordHash
    }
  });
}

async function main() {
  const admin = await upsertUser({
    email: "admin@ecoms.local",
    fullName: "Ecoms Admin",
    role: "ADMIN",
    passwordHash: "$2a$12$eixZaYVK1fsbw1ZfbX3OXePaWxn96p36uJpqG8Q3G.NB0I6CLlcG6"
  });

  const seller = await upsertUser({
    email: "seller@ecoms.local",
    fullName: "Demo Seller",
    role: "SELLER",
    passwordHash: "$2a$12$eixZaYVK1fsbw1ZfbX3OXePaWxn96p36uJpqG8Q3G.NB0I6CLlcG6"
  });

  await upsertUser({
    email: "buyer@ecoms.local",
    fullName: "Demo Buyer",
    role: "CUSTOMER",
    passwordHash: "$2a$12$eixZaYVK1fsbw1ZfbX3OXePaWxn96p36uJpqG8Q3G.NB0I6CLlcG6"
  });

  const electronics = await prisma.category.upsert({
    where: { slug: "electronics" },
    update: {
      name: "Electronics",
      description: "Devices, accessories, and gadgets"
    },
    create: {
      name: "Electronics",
      slug: "electronics",
      description: "Devices, accessories, and gadgets"
    }
  });

  await prisma.category.upsert({
    where: { slug: "mobile-accessories" },
    update: {
      name: "Mobile Accessories",
      parentId: electronics.id,
      description: "Chargers, cases, cables, and more"
    },
    create: {
      name: "Mobile Accessories",
      slug: "mobile-accessories",
      parentId: electronics.id,
      description: "Chargers, cases, cables, and more"
    }
  });

  await prisma.brand.upsert({
    where: { slug: "demo-brand" },
    update: {
      name: "Demo Brand",
      description: "Seeded default brand for development"
    },
    create: {
      name: "Demo Brand",
      slug: "demo-brand",
      description: "Seeded default brand for development"
    }
  });

  await prisma.shop.upsert({
    where: { ownerId: seller.id },
    update: {
      name: "Demo Seller Shop",
      slug: "demo-seller-shop",
      description: "Seeded demo seller storefront",
      status: "ACTIVE"
    },
    create: {
      ownerId: seller.id,
      name: "Demo Seller Shop",
      slug: "demo-seller-shop",
      description: "Seeded demo seller storefront",
      status: "ACTIVE"
    }
  });

  const shop = await prisma.shop.findUnique({
    where: { ownerId: seller.id }
  });

  const brand = await prisma.brand.findUnique({
    where: { slug: "demo-brand" }
  });

  if (shop && brand) {
    const product = await prisma.product.upsert({
      where: { slug: "demo-wireless-gaming-mouse" },
      update: {
        shopId: shop.id,
        categoryId: electronics.id,
        brandId: brand.id,
        name: "Demo Wireless Gaming Mouse",
        sku: "DEMO-MOUSE-001",
        description: "Seeded flagship accessory for storefront, cart, voucher, and flash-sale testing.",
        originalPrice: 499000,
        salePrice: 399000,
        status: "ACTIVE",
        stock: 120,
        weightGrams: 420,
        lengthCm: 12,
        widthCm: 7,
        heightCm: 4,
        tags: ["gaming", "wireless", "seeded"],
        deletedAt: null
      },
      create: {
        shopId: shop.id,
        categoryId: electronics.id,
        brandId: brand.id,
        name: "Demo Wireless Gaming Mouse",
        slug: "demo-wireless-gaming-mouse",
        sku: "DEMO-MOUSE-001",
        description: "Seeded flagship accessory for storefront, cart, voucher, and flash-sale testing.",
        originalPrice: 499000,
        salePrice: 399000,
        status: "ACTIVE",
        stock: 120,
        weightGrams: 420,
        lengthCm: 12,
        widthCm: 7,
        heightCm: 4,
        tags: ["gaming", "wireless", "seeded"]
      }
    });

    await prisma.productImage.deleteMany({
      where: { productId: product.id }
    });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80",
        altText: "Demo Wireless Gaming Mouse",
        sortOrder: 0
      }
    });

    await prisma.productVariant.deleteMany({
      where: { productId: product.id }
    });
    await prisma.productVariant.createMany({
      data: [
        {
          productId: product.id,
          sku: "DEMO-MOUSE-001-BLACK",
          name: "Black",
          attributes: { color: "Black" },
          price: 399000,
          stock: 80,
          isDefault: true
        },
        {
          productId: product.id,
          sku: "DEMO-MOUSE-001-WHITE",
          name: "White",
          attributes: { color: "White" },
          price: 419000,
          stock: 40,
          isDefault: false
        }
      ]
    });

    const existingFlashSale = await prisma.flashSale.findFirst({
      where: { name: "Mega Tech Hour" }
    });

    const flashSaleUpdateData = {
      description: "Seeded flash sale for homepage and product pricing demos",
      startsAt: new Date("2026-04-17T09:00:00.000Z"),
      endsAt: new Date("2099-04-18T09:00:00.000Z"),
      status: "ACTIVE",
      items: {
        deleteMany: {},
        create: [
          {
            productId: product.id,
            flashPrice: 299000,
            stockLimit: 50,
            soldCount: 8,
            sortOrder: 0
          }
        ]
      }
    };

    const flashSaleCreateData = {
      description: "Seeded flash sale for homepage and product pricing demos",
      startsAt: new Date("2026-04-17T09:00:00.000Z"),
      endsAt: new Date("2099-04-18T09:00:00.000Z"),
      status: "ACTIVE",
      items: {
        create: [
          {
            productId: product.id,
            flashPrice: 299000,
            stockLimit: 50,
            soldCount: 8,
            sortOrder: 0
          }
        ]
      }
    };

    if (existingFlashSale) {
      await prisma.flashSale.update({
        where: { id: existingFlashSale.id },
        data: {
          name: "Mega Tech Hour",
          ...flashSaleUpdateData
        }
      });
    } else {
      await prisma.flashSale.create({
        data: {
          name: "Mega Tech Hour",
          ...flashSaleCreateData
        }
      });
    }
  }

  await prisma.voucher.upsert({
    where: { code: "PLATFORM50K" },
    update: {
      name: "Platform 50k off",
      scope: "PLATFORM",
      discountType: "FIXED",
      discountValue: 50000,
      minOrderValue: 300000,
      totalQuantity: 500,
      perUserUsageLimit: 3,
      isActive: true,
      createdByUserId: admin.id
    },
    create: {
      code: "PLATFORM50K",
      name: "Platform 50k off",
      description: "Seeded platform-wide fixed discount voucher",
      scope: "PLATFORM",
      discountType: "FIXED",
      discountValue: 50000,
      minOrderValue: 300000,
      totalQuantity: 500,
      perUserUsageLimit: 3,
      isActive: true,
      createdByUserId: admin.id
    }
  });

  await prisma.voucher.upsert({
    where: { code: "FREESHIP30K" },
    update: {
      name: "Freeship up to 30k",
      scope: "FREESHIP",
      discountType: "FIXED",
      discountValue: 30000,
      minOrderValue: 200000,
      totalQuantity: 500,
      perUserUsageLimit: 2,
      isActive: true,
      createdByUserId: admin.id
    },
    create: {
      code: "FREESHIP30K",
      name: "Freeship up to 30k",
      description: "Seeded shipping discount voucher",
      scope: "FREESHIP",
      discountType: "FIXED",
      discountValue: 30000,
      minOrderValue: 200000,
      totalQuantity: 500,
      perUserUsageLimit: 2,
      isActive: true,
      createdByUserId: admin.id
    }
  });

  if (shop) {
    await prisma.voucher.upsert({
      where: { code: "SHOP10OFF" },
      update: {
        name: "Demo shop 10% off",
        scope: "SHOP",
        discountType: "PERCENTAGE",
        discountValue: 10,
        maxDiscountAmount: 80000,
        minOrderValue: 250000,
        totalQuantity: 300,
        perUserUsageLimit: 2,
        isActive: true,
        shopId: shop.id,
        createdByUserId: seller.id
      },
      create: {
        code: "SHOP10OFF",
        name: "Demo shop 10% off",
        description: "Seeded seller voucher for checkout demos",
        scope: "SHOP",
        discountType: "PERCENTAGE",
        discountValue: 10,
        maxDiscountAmount: 80000,
        minOrderValue: 250000,
        totalQuantity: 300,
        perUserUsageLimit: 2,
        isActive: true,
        shopId: shop.id,
        createdByUserId: seller.id
      }
    });
  }

  console.log("Seed completed", {
    adminId: admin.id,
    sellerId: seller.id
  });
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
