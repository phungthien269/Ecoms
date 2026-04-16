import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env";
import { AuthModule } from "./modules/auth/auth.module";
import { BrandsModule } from "./modules/brands/brands.module";
import { CartModule } from "./modules/cart/cart.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { HealthModule } from "./modules/health/health.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { ProductsModule } from "./modules/products/products.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { ShopsModule } from "./modules/shops/shops.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RbacModule,
    CartModule,
    CategoriesModule,
    BrandsModule,
    ShopsModule,
    ProductsModule
  ]
})
export class AppModule {}
