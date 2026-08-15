import "dotenv/config";

import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import ws from "ws";
import { z } from "zod";

const config = z
  .object({
    DIRECT_URL: z.string().min(1),
    DATABASE_ADAPTER: z.enum(["neon", "pg"]).default("neon"),
    ADMIN_EMAIL: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    ADMIN_PASSWORD: z
      .string()
      .min(12)
      .max(72)
      .regex(/[a-z]/)
      .regex(/[A-Z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/)
      .refine((value) => new TextEncoder().encode(value).byteLength <= 72),
  })
  .parse(process.env);

neonConfig.webSocketConstructor = ws;
const adapter =
  config.DATABASE_ADAPTER === "neon"
    ? new PrismaNeon({ connectionString: config.DIRECT_URL })
    : new PrismaPg({ connectionString: config.DIRECT_URL, max: 2 });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, 12);
  await prisma.admin.upsert({
    where: { email: config.ADMIN_EMAIL },
    create: { email: config.ADMIN_EMAIL, passwordHash },
    update: { passwordHash },
    select: { id: true },
  });
  console.log("Administrador provisionado/rotacionado sem alterar o catálogo.");
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "admin.provision_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      })
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
