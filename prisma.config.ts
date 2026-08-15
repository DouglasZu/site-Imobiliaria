import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations-postgresql",
    seed: "npx tsx prisma/seed.ts",
  },
  // Prisma 7 reads its CLI URL here. Use Neon's unpooled URL for migrations.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
