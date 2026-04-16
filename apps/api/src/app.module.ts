import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { resolve } from "node:path";
import { validateEnv } from "./config/env";
import { AuthModule } from "./modules/auth/auth.module";
import { BrandsModule } from "./modules/brands/brands.module";
import { CartModule } from "./modules/cart/cart.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { HealthModule } from "./modules/health/health.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { ProductsModule } from "./modules/products/products.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { ShopsModule } from "./modules/shops/shops.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")],
      validate: validateEnv
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RbacModule,
    CartModule,
    CheckoutModule,
    CategoriesModule,
    BrandsModule,
    OrdersModule,
    ShopsModule,
    ProductsModule
  ]
})
export class AppModule {}
