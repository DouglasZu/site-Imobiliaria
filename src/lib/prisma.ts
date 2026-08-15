import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    // Query/error payloads may contain credentials or personal data. Routes
    // emit their own structured, redacted events instead.
    log: env.NODE_ENV === "development" ? ["warn"] : [],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
