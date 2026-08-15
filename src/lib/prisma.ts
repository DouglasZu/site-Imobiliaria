import "server-only";

import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import ws from "ws";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const adapter =
    env.DATABASE_ADAPTER === "neon"
      ? createNeonAdapter()
      : new PrismaPg({ connectionString: env.DATABASE_URL, max: 5 });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn"] : [],
  });
}

function createNeonAdapter() {
  try {
    neonConfig.webSocketConstructor = ws;
    return new PrismaNeon({ connectionString: env.DATABASE_URL });
  } catch {
    return new PrismaPg({ connectionString: env.DATABASE_URL, max: 5 });
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
