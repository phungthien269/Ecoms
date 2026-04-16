CREATE TYPE "VoucherScope" AS ENUM ('PLATFORM', 'SHOP', 'FREESHIP');
CREATE TYPE "VoucherDiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

ALTER TABLE "Order"
ADD COLUMN "appliedVoucherCodes" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL;

CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "VoucherScope" NOT NULL,
    "discountType" "VoucherDiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "maxDiscountAmount" DECIMAL(12,2),
    "minOrderValue" DECIMAL(12,2),
    "totalQuantity" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perUserUsageLimit" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "shopId" TEXT,
    "categoryId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoucherRedemption" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkoutReference" TEXT NOT NULL,
    "orderIds" TEXT[] NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");
CREATE INDEX "Voucher_scope_isActive_expiresAt_idx" ON "Voucher"("scope", "isActive", "expiresAt");
CREATE INDEX "Voucher_shopId_scope_isActive_idx" ON "Voucher"("shopId", "scope", "isActive");
CREATE INDEX "Voucher_categoryId_scope_isActive_idx" ON "Voucher"("categoryId", "scope", "isActive");

CREATE INDEX "VoucherRedemption_voucherId_createdAt_idx" ON "VoucherRedemption"("voucherId", "createdAt");
CREATE INDEX "VoucherRedemption_userId_createdAt_idx" ON "VoucherRedemption"("userId", "createdAt");
CREATE UNIQUE INDEX "VoucherRedemption_voucherId_checkoutReference_key" ON "VoucherRedemption"("voucherId", "checkoutReference");

ALTER TABLE "Voucher"
ADD CONSTRAINT "Voucher_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Voucher"
ADD CONSTRAINT "Voucher_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Voucher"
ADD CONSTRAINT "Voucher_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VoucherRedemption"
ADD CONSTRAINT "VoucherRedemption_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VoucherRedemption"
ADD CONSTRAINT "VoucherRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
