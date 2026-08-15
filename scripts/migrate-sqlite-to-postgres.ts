import "dotenv/config";

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  PropertyPurpose,
  PropertyType,
} from "@prisma/client";
import ws from "ws";
import { z } from "zod";

const CONFIRMATION = "IMPORT_LEGACY_CATALOG";
const execute = process.argv.includes("--execute");

const baseEnvSchema = z.object({
  LEGACY_SQLITE_PATH: z.string().min(1),
  DATABASE_ADAPTER: z.enum(["neon", "pg"]).default("neon"),
});

const baseEnv = baseEnvSchema.parse(process.env);
const legacyPath = resolve(baseEnv.LEGACY_SQLITE_PATH);

if (!existsSync(legacyPath) || !statSync(legacyPath).isFile() || statSync(legacyPath).size === 0) {
  throw new Error("LEGACY_SQLITE_PATH deve apontar para um arquivo SQLite existente e não vazio.");
}

if (execute && process.env.LEGACY_MIGRATION_CONFIRM !== CONFIRMATION) {
  throw new Error(
    `Execução bloqueada. Defina LEGACY_MIGRATION_CONFIRM=${CONFIRMATION} para importar em um catálogo PostgreSQL vazio.`
  );
}

const propertyRowSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(5_000),
  price: z.string().regex(/^\d{1,12}\.\d{2}$/),
  city: z.string().min(1).max(100),
  neighborhood: z.string().min(1).max(100),
  address: z.string().max(300).nullable(),
  type: z.nativeEnum(PropertyType),
  purpose: z.nativeEnum(PropertyPurpose),
  bedrooms: z.number().int().min(0).max(100).nullable(),
  bathrooms: z.number().int().min(0).max(100).nullable(),
  area: z.number().finite().positive().max(10_000_000).nullable(),
  whatsappPhone: z.string().regex(/^\d{10,15}$/).nullable(),
  featured: z.union([z.literal(0), z.literal(1)]).transform(Boolean),
  active: z.union([z.literal(0), z.literal(1)]).transform(Boolean),
  createdAt: z.string().transform((value, context) => parseDate(value, context)),
  updatedAt: z.string().transform((value, context) => parseDate(value, context)),
});

const imageRowSchema = z.object({
  id: z.string().min(1).max(64),
  url: z.string().url().max(2_048).refine((value) => value.startsWith("https://")),
  order: z.number().int().min(0).max(11),
  propertyId: z.string().min(1).max(64),
});

function parseDate(value: string, context: z.RefinementCtx): Date {
  const normalized = value.replace(" ", "T");
  const parsed = new Date(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`
  );
  if (Number.isNaN(parsed.getTime())) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Data SQLite inválida" });
    return z.NEVER;
  }
  return parsed;
}

function assertLegacySchema(database: DatabaseSync) {
  const required = new Set(["Property", "Image"]);
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  for (const table of tables) required.delete(table.name);
  if (required.size > 0) {
    throw new Error(`Schema SQLite incompatível; tabelas ausentes: ${[...required].join(", ")}`);
  }

  const propertyColumns = new Set(
    (database.prepare('PRAGMA table_info("Property")').all() as Array<{ name: string }>).map(
      (column) => column.name
    )
  );
  for (const column of ["purpose", "whatsappPhone", "createdAt", "updatedAt"]) {
    if (!propertyColumns.has(column)) {
      throw new Error(`Schema SQLite incompatível; coluna Property.${column} ausente.`);
    }
  }
}

async function main() {
  const sqlite = new DatabaseSync(legacyPath, { readOnly: true });

  try {
    assertLegacySchema(sqlite);

    const properties = z.array(propertyRowSchema).parse(
      sqlite
        .prepare(`
        SELECT id, title, description, printf('%.2f', price) AS price,
               city, neighborhood, address, type, purpose, bedrooms,
               bathrooms, area, whatsappPhone, featured, active,
               createdAt, updatedAt
        FROM "Property"
        ORDER BY id
      `)
        .all()
    );

    const images = z.array(imageRowSchema).parse(
      sqlite
        .prepare('SELECT id, url, "order", propertyId FROM "Image" ORDER BY propertyId, "order"')
        .all()
    );

    const propertyIds = new Set(properties.map((property) => property.id));
    const orphan = images.find((image) => !propertyIds.has(image.propertyId));
    if (orphan) throw new Error("O banco legado contém imagem órfã.");

    const positions = new Set<string>();
    for (const image of images) {
      const position = `${image.propertyId}:${image.order}`;
      if (positions.has(position)) {
        throw new Error("O banco legado contém ordem de imagem duplicada.");
      }
      positions.add(position);
    }

    console.log(
      JSON.stringify({
        mode: execute ? "execute" : "dry-run",
        source: legacyPath,
        properties: properties.length,
        images: images.length,
        adminsImported: 0,
        rateLimitBucketsImported: 0,
      })
    );

    if (!execute) {
      console.log(
        `Validação concluída. Para importar, use --execute e LEGACY_MIGRATION_CONFIRM=${CONFIRMATION}.`
      );
      return;
    }

    const targetEnv = z.object({ DIRECT_URL: z.string().min(1) }).parse(process.env);
    neonConfig.webSocketConstructor = ws;
    const adapter =
      baseEnv.DATABASE_ADAPTER === "neon"
        ? new PrismaNeon({ connectionString: targetEnv.DIRECT_URL })
        : new PrismaPg({ connectionString: targetEnv.DIRECT_URL, max: 2 });
    const prisma = new PrismaClient({ adapter });

    try {
      const [targetProperties, targetImages] = await Promise.all([
        prisma.property.count(),
        prisma.image.count(),
      ]);
      if (targetProperties !== 0 || targetImages !== 0) {
        throw new Error("Importação recusada: o catálogo PostgreSQL de destino não está vazio.");
      }

      await prisma.$transaction(
        async (transaction) => {
          for (const property of properties) {
            await transaction.property.create({ data: property });
          }
          for (const image of images) {
            await transaction.image.create({
              data: { ...image, storageKey: null },
            });
          }
        },
        { maxWait: 10_000, timeout: 60_000 }
      );

      const [importedProperties, importedImages] = await Promise.all([
        prisma.property.count(),
        prisma.image.count(),
      ]);
      if (importedProperties !== properties.length || importedImages !== images.length) {
        throw new Error("As contagens após a importação não correspondem à origem.");
      }

      console.log(
        JSON.stringify({
          importedProperties,
          importedImages,
          adminsImported: 0,
          note: "Provisione um novo admin com npm run admin:provision; hashes legados não foram copiados.",
        })
      );
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : "UnknownError";
  const validation =
    error instanceof z.ZodError
      ? error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      : undefined;
  console.error(
    JSON.stringify({ event: "legacy_migration.failed", error: name, ...(validation ? { validation } : {}) })
  );
  process.exitCode = 1;
});
