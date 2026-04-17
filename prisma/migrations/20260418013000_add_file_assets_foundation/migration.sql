CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "bucket" TEXT,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "url" TEXT NOT NULL,
    "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FileAsset_driver_objectKey_key" ON "FileAsset"("driver", "objectKey");
CREATE INDEX "FileAsset_createdById_createdAt_idx" ON "FileAsset"("createdById", "createdAt");
CREATE INDEX "FileAsset_status_createdAt_idx" ON "FileAsset"("status", "createdAt");

ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
