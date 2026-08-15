-- Normalize indexes that may already exist in databases updated with `prisma db push`.
DROP INDEX IF EXISTS "Property_active_featured_createdAt_idx";
DROP INDEX IF EXISTS "Property_city_idx";
DROP INDEX IF EXISTS "Property_type_idx";
DROP INDEX IF EXISTS "Property_purpose_idx";
DROP INDEX IF EXISTS "Image_propertyId_order_idx";

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Property_active_featured_createdAt_idx" ON "Property"("active", "featured" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Property_city_idx" ON "Property"("city");

-- CreateIndex
CREATE INDEX "Property_type_idx" ON "Property"("type");

-- CreateIndex
CREATE INDEX "Property_purpose_idx" ON "Property"("purpose");

-- CreateIndex
CREATE INDEX "Image_propertyId_order_idx" ON "Image"("propertyId", "order");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
