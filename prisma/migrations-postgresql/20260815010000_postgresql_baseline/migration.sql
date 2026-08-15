-- PostgreSQL baseline. The legacy SQLite history is intentionally isolated in
-- prisma/migrations-sqlite-legacy and must never be applied to PostgreSQL.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'FARM');
CREATE TYPE "PropertyPurpose" AS ENUM ('SALE', 'RENT');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ARCHIVED');
CREATE TYPE "LeadNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'UNKNOWN', 'DISABLED');

CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "address" TEXT,
    "type" "PropertyType" NOT NULL,
    "purpose" "PropertyPurpose" NOT NULL DEFAULT 'SALE',
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "area" DOUBLE PRECISION,
    "whatsappPhone" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Property_price_positive" CHECK ("price" > 0),
    CONSTRAINT "Property_bedrooms_valid" CHECK ("bedrooms" IS NULL OR "bedrooms" >= 0),
    CONSTRAINT "Property_bathrooms_valid" CHECK ("bathrooms" IS NULL OR "bathrooms" >= 0),
    CONSTRAINT "Property_area_positive" CHECK ("area" IS NULL OR "area" > 0),
    CONSTRAINT "Property_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Image_order_valid" CHECK ("order" BETWEEN 0 AND 11),
    CONSTRAINT "Image_byteSize_valid" CHECK ("byteSize" IS NULL OR "byteSize" > 0)
);

CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "propertyId" TEXT,
    "propertyTitle" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notificationStatus" "LeadNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "notificationId" TEXT,
    "notificationAttemptedAt" TIMESTAMPTZ(3),
    "notificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Lead_notificationAttempts_valid" CHECK ("notificationAttempts" >= 0)
);

CREATE TABLE "PendingUpload" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "signedExpiresAt" TIMESTAMPTZ(3),
    "consumedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cleanupAttempts" INTEGER NOT NULL DEFAULT 0,
    "cleanupLastAttemptAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingUpload_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PendingUpload_byteSize_valid" CHECK ("byteSize" BETWEEN 1 AND 10485760),
    CONSTRAINT "PendingUpload_cleanupAttempts_valid" CHECK ("cleanupAttempts" >= 0)
);

CREATE TABLE "StorageCleanupTask" (
    "storageKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMPTZ(3),
    "notBefore" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorageCleanupTask_pkey" PRIMARY KEY ("storageKey"),
    CONSTRAINT "StorageCleanupTask_attempts_valid" CHECK ("attempts" >= 0)
);

CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "RateLimitBucket_count_valid" CHECK ("count" >= 0)
);

CREATE INDEX "Property_active_featured_createdAt_idx" ON "Property"("active", "featured" DESC, "createdAt" DESC);
CREATE INDEX "Property_city_idx" ON "Property"("city");
CREATE INDEX "Property_type_idx" ON "Property"("type");
CREATE INDEX "Property_purpose_idx" ON "Property"("purpose");
CREATE UNIQUE INDEX "Image_storageKey_key" ON "Image"("storageKey");
CREATE UNIQUE INDEX "Image_propertyId_order_key" ON "Image"("propertyId", "order");
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
CREATE UNIQUE INDEX "Lead_requestId_key" ON "Lead"("requestId");
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt" DESC);
CREATE INDEX "Lead_propertyId_createdAt_idx" ON "Lead"("propertyId", "createdAt" DESC);
CREATE UNIQUE INDEX "PendingUpload_storageKey_key" ON "PendingUpload"("storageKey");
CREATE INDEX "PendingUpload_adminId_expiresAt_idx" ON "PendingUpload"("adminId", "expiresAt");
CREATE INDEX "PendingUpload_propertyId_expiresAt_idx" ON "PendingUpload"("propertyId", "expiresAt");
CREATE INDEX "PendingUpload_consumedAt_cancelledAt_expiresAt_idx" ON "PendingUpload"("consumedAt", "cancelledAt", "expiresAt");
CREATE INDEX "StorageCleanupTask_notBefore_lastAttemptAt_idx" ON "StorageCleanupTask"("notBefore", "lastAttemptAt");
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

ALTER TABLE "Image" ADD CONSTRAINT "Image_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PendingUpload" ADD CONSTRAINT "PendingUpload_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
