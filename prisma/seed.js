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
