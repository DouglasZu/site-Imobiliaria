-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "address" TEXT,
    "type" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'SALE',
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "area" REAL,
    "whatsappPhone" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Property" ("active", "address", "area", "bathrooms", "bedrooms", "city", "createdAt", "description", "featured", "id", "neighborhood", "price", "title", "type", "updatedAt") SELECT "active", "address", "area", "bathrooms", "bedrooms", "city", "createdAt", "description", "featured", "id", "neighborhood", "price", "title", "type", "updatedAt" FROM "Property";
DROP TABLE "Property";
ALTER TABLE "new_Property" RENAME TO "Property";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
