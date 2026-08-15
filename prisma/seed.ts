import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { z } from "zod";

const seedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória."),
  ADMIN_EMAIL: z
    .string()
    .trim()
    .email("ADMIN_EMAIL deve ser um email válido.")
    .max(254, "ADMIN_EMAIL deve ter no máximo 254 caracteres.")
    .transform((email) => email.toLowerCase()),
  ADMIN_PASSWORD: z
    .string()
    .min(12, "ADMIN_PASSWORD deve ter pelo menos 12 caracteres.")
    .max(72, "ADMIN_PASSWORD deve ter no máximo 72 caracteres.")
    .regex(/[a-z]/, "ADMIN_PASSWORD deve conter uma letra minúscula.")
    .regex(/[A-Z]/, "ADMIN_PASSWORD deve conter uma letra maiúscula.")
    .regex(/[0-9]/, "ADMIN_PASSWORD deve conter um número.")
    .regex(/[^A-Za-z0-9]/, "ADMIN_PASSWORD deve conter um caractere especial.")
    .refine(
      (password) => new TextEncoder().encode(password).byteLength <= 72,
      "ADMIN_PASSWORD deve ter no máximo 72 bytes UTF-8."
    ),
  SEED_REPLACE_CONFIRM: z.literal("REPLACE_CATALOG_AND_ADMINS", {
    errorMap: () => ({
      message:
        "Defina SEED_REPLACE_CONFIRM=REPLACE_CATALOG_AND_ADMINS somente para autorizar esta substituição destrutiva.",
    }),
  }),
  ALLOW_PRODUCTION_SEED: z.enum(["true", "false"]).optional(),
});

const parsedEnv = seedEnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Configuração do seed inválida:",
    parsedEnv.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }))
  );
  throw new Error("Invalid seed environment");
}

if (
  process.env.NODE_ENV === "production" &&
  parsedEnv.data.ALLOW_PRODUCTION_SEED !== "true"
) {
  throw new Error(
    "Seed em produção bloqueado. Defina ALLOW_PRODUCTION_SEED=true explicitamente para autorizar."
  );
}

const seedEnv = parsedEnv.data;

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: seedEnv.DATABASE_URL }),
});

const sampleProperties = [
  {
    title: "Apartamento Moderno no Centro",
    description: `Apartamento totalmente reformado com acabamento de alto padrão no coração da cidade. Sala ampla com varanda gourmet, cozinha americana com armários planejados, 2 quartos sendo 1 suíte com closet.

Condomínio com piscina, academia, salão de festas e segurança 24h. Próximo a metrô, escolas, hospitais e comércio.

Ideal para casais ou pequenas famílias que buscam praticidade e conforto.`,
    price: 2800,
    city: "São Paulo",
    neighborhood: "Vila Mariana",
    address: "Rua Domingos de Morais, 1200",
    type: "APARTMENT" as const,
    purpose: "RENT" as const,
    bedrooms: 2,
    bathrooms: 2,
    area: 75,
    featured: true,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
    ],
  },
  {
    title: "Casa com Jardim em Condomínio Fechado",
    description: `Linda casa em condomínio fechado com amplo jardim e área de lazer. 3 quartos (1 suíte master com banheira), sala de estar e jantar integradas, cozinha planejada, área gourmet com churrasqueira.

Garagem para 3 carros. Condomínio com portaria 24h, playground e quadra poliesportiva.

Excelente localização com fácil acesso às principais vias da região.`,
    price: 850000,
    city: "São Paulo",
    neighborhood: "Alphaville",
    address: "Alameda das Palmeiras, 456",
    type: "HOUSE" as const,
    bedrooms: 3,
    bathrooms: 3,
    area: 200,
    featured: true,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
    ],
  },
  {
    title: "Cobertura Duplex com Vista para o Mar",
    description: `Espetacular cobertura duplex com vista panorâmica para o mar. Sala ampla com pé direito duplo, varanda com piscina privativa, 4 quartos sendo 2 suítes.

Pavimento superior com terraço gourmet, spa e solarium. Acabamento em mármore e porcelanato de primeira linha.

Localização privilegiada, a 2 quadras da praia.`,
    price: 1500000,
    city: "Santos",
    neighborhood: "Gonzaga",
    address: "Av. Ana Costa, 789",
    type: "APARTMENT" as const,
    bedrooms: 4,
    bathrooms: 4,
    area: 320,
    featured: true,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80",
      "https://images.unsplash.com/photo-1600573472556-e636c2acda9e?w=1200&q=80",
    ],
  },
  {
    title: "Terreno em Área Nobre para Construção",
    description: `Terreno plano em área nobre, ideal para construção de residência de alto padrão. Documentação em dia, pronto para construir.

Medidas: 15m de frente x 30m de fundo. Infraestrutura completa: água, luz, esgoto e asfalto.

Vizinhança residencial com casas de alto padrão.`,
    price: 320000,
    city: "Campinas",
    neighborhood: "Barão Geraldo",
    address: "Rua das Orquídeas, 100",
    type: "LAND" as const,
    bedrooms: null,
    bathrooms: null,
    area: 450,
    featured: false,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80",
      "https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?w=1200&q=80",
    ],
  },
  {
    title: "Apartamento Studio Mobiliado",
    description: `Studio moderno e funcional, totalmente mobiliado e decorado. Ideal para estudantes ou profissionais. Cozinha integrada com eletrodomésticos inclusos.

Prédio com lavanderia compartilhada, coworking e rooftop com vista panorâmica.

A 5 minutos a pé da estação de metrô.`,
    price: 1800,
    city: "São Paulo",
    neighborhood: "Consolação",
    address: "Rua Augusta, 2500",
    type: "APARTMENT" as const,
    purpose: "RENT" as const,
    bedrooms: 1,
    bathrooms: 1,
    area: 35,
    featured: false,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=1200&q=80",
      "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=1200&q=80",
    ],
  },
  {
    title: "Casa Térrea com Piscina",
    description: `Casa térrea com excelente localização. Sala ampla, 3 quartos (1 suíte), cozinha planejada, área de serviço, quintal com piscina e churrasqueira.

Garagem coberta para 2 carros. Rua tranquila, próximo a escolas e supermercados.

Ótima opção para famílias que buscam conforto e segurança.`,
    price: 520000,
    city: "Ribeirão Preto",
    neighborhood: "Jardim Sumaré",
    address: "Rua Maranhão, 350",
    type: "HOUSE" as const,
    bedrooms: 3,
    bathrooms: 2,
    area: 180,
    featured: false,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80",
      "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1200&q=80",
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1200&q=80",
    ],
  },
  {
    title: "Sala Comercial no Centro Empresarial",
    description: `Sala comercial com localização estratégica no principal centro empresarial da cidade. Ambiente climatizado, piso elevado, infraestrutura para cabeamento.

Edifício com recepção, elevadores, estacionamento rotativo e segurança 24h.

Ideal para escritórios, consultórios ou coworkings.`,
    price: 380000,
    city: "São Paulo",
    neighborhood: "Itaim Bibi",
    address: "Av. Brigadeiro Faria Lima, 3000",
    type: "COMMERCIAL" as const,
    bedrooms: null,
    bathrooms: 2,
    area: 90,
    featured: false,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80",
    ],
  },
  {
    title: "Chácara com Lago e Área Verde",
    description: `Chácara encantadora com ampla área verde, lago para pesca, pomar com árvores frutíferas e horta orgânica.

Casa sede com 4 quartos, sala rústica com lareira, varandão, cozinha caipira e área gourmet com forno de pizza e churrasqueira.

Perfeita para quem busca tranquilidade e contato com a natureza.`,
    price: 680000,
    city: "Ibiúna",
    neighborhood: "Zona Rural",
    address: "Estrada do Sítio, Km 5",
    type: "FARM" as const,
    bedrooms: 4,
    bathrooms: 3,
    area: 5000,
    featured: true,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=1200&q=80",
      "https://images.unsplash.com/photo-1505843513577-22bb7d21e455?w=1200&q=80",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80",
    ],
  },
  {
    title: "Apartamento Garden com Churrasqueira",
    description: `Apartamento garden (térreo) com quintal privativo e churrasqueira. 2 quartos com armários, sala ampla, cozinha americana com balcão.

Área externa com jardim e espaço para pets. Condomínio com playground, piscina e academia.

Localizado em bairro residencial tranquilo, próximo a parques e áreas de lazer.`,
    price: 395000,
    city: "Curitiba",
    neighborhood: "Ecoville",
    address: "Rua Pedro Demeterco, 800",
    type: "APARTMENT" as const,
    bedrooms: 2,
    bathrooms: 1,
    area: 85,
    featured: false,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=80",
    ],
  },
  {
    title: "Sobrado Novo com 4 Suítes",
    description: `Sobrado novo, nunca habitado, com acabamento premium. 4 suítes com ar-condicionado, sala de TV, sala de jantar, home office, cozinha gourmet.

Área gourmet com churrasqueira e forno de pizza. Piscina aquecida com deck em madeira. Garagem para 4 carros.

Automação residencial completa com sistema de som e iluminação inteligente.`,
    price: 1200000,
    city: "São Paulo",
    neighborhood: "Moema",
    address: "Rua dos Maracatins, 500",
    type: "HOUSE" as const,
    bedrooms: 4,
    bathrooms: 5,
    area: 350,
    featured: true,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80",
    ],
  },
  {
    title: "Loft Industrial no Centro Histórico",
    description: `Loft estilo industrial em prédio histórico restaurado. Pé direito de 4 metros, tijolos aparentes, grandes janelas com luz natural.

Espaço open plan com sala, cozinha e quarto integrados. Banheiro com acabamento em concreto e box de vidro.

Localização central, próximo a restaurantes, bares e galerias de arte.`,
    price: 2400,
    city: "São Paulo",
    neighborhood: "República",
    address: "Rua Barão de Itapetininga, 150",
    type: "APARTMENT" as const,
    purpose: "RENT" as const,
    bedrooms: 1,
    bathrooms: 1,
    area: 55,
    featured: false,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
    ],
  },
  {
    title: "Terreno Comercial em Avenida Principal",
    description: `Terreno comercial em avenida de grande fluxo, ideal para construção de loja, clínica ou estacionamento.

Documentação regular, zoneamento misto. Infraestrutura completa.

Excelente visibilidade e acesso facilitado.`,
    price: 750000,
    city: "Campinas",
    neighborhood: "Cambuí",
    address: "Av. José de Souza Campos, 1000",
    type: "LAND" as const,
    bedrooms: null,
    bathrooms: null,
    area: 600,
    featured: false,
    active: true,
    images: [
      "https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?w=1200&q=80",
    ],
  },
];

async function seed() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash(seedEnv.ADMIN_PASSWORD, 12);

  await prisma.$transaction(async (tx) => {
    // Rebuild seed-owned data atomically so a partial failure never destroys the catalog.
    await tx.image.deleteMany();
    await tx.property.deleteMany();
    await tx.admin.deleteMany();

    // The seed intentionally leaves exactly one administrator.
    await tx.admin.create({
      data: {
        email: seedEnv.ADMIN_EMAIL,
        passwordHash,
      },
    });

    for (const prop of sampleProperties) {
      const { images, ...propertyData } = prop;
      await tx.property.create({
        data: {
          ...propertyData,
          images: {
            create: images.map((url, index) => ({
              url,
              publicId: "",
              order: index,
            })),
          },
        },
      });
    }
  });

  console.log("✅ Admin created from validated environment variables");
  console.log("🗑️  Replaced existing seed data atomically");
  console.log(`✅ Created ${sampleProperties.length} sample properties`);
  console.log("\n🎉 Seed completed successfully!");
}

seed()
  .catch((error: unknown) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;

    console.error("Seed failed:", { errorName, errorCode });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
