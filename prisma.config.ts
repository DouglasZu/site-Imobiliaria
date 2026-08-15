import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations-postgresql",
    seed: "npx tsx prisma/seed.ts",
  },
  // Prisma 7 reads its CLI URL here. Use Neon's unpooled URL for migrations if available.
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
