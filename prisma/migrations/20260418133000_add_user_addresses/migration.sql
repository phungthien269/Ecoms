CREATE TABLE "UserAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "ward" TEXT,
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAddress_userId_isDefault_updatedAt_idx" ON "UserAddress"("userId", "isDefault", "updatedAt");
CREATE INDEX "UserAddress_userId_deletedAt_updatedAt_idx" ON "UserAddress"("userId", "deletedAt", "updatedAt");

ALTER TABLE "UserAddress"
ADD CONSTRAINT "UserAddress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
