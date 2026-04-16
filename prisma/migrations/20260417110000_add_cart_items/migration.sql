CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CartItem_userId_updatedAt_idx" ON "CartItem"("userId", "updatedAt");
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");
CREATE INDEX "CartItem_productVariantId_idx" ON "CartItem"("productVariantId");

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_productVariantId_fkey"
FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
