import { z } from "zod";
import { isAllowedPropertyImageUrl } from "@/lib/image-policy";

export const PROPERTY_TYPES = [
  "HOUSE",
  "APARTMENT",
  "LAND",
  "COMMERCIAL",
  "FARM",
] as const;

export const PROPERTY_PURPOSES = ["SALE", "RENT"] as const;

const nullableText = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().trim().max(max).nullable()
  );

const nullableNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce.number().pipe(schema).nullable()
  );

export const propertyImageSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1, "Informe a URL da imagem")
      .max(2_048, "A URL da imagem é muito longa")
      .refine(
        isAllowedPropertyImageUrl,
        "Use uma URL HTTPS válida do domínio images.unsplash.com"
      ),
    order: z.coerce.number().int().min(0).max(11).optional(),
  })
  .strict("A imagem contém campos não permitidos");

export const propertySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, "O título deve ter pelo menos 5 caracteres")
      .max(120, "O título deve ter no máximo 120 caracteres"),
    description: z
      .string()
      .trim()
      .min(20, "A descrição deve ter pelo menos 20 caracteres")
      .max(5_000, "A descrição deve ter no máximo 5.000 caracteres"),
    price: z.coerce
      .number()
      .finite("O preço deve ser um número válido")
      .positive("O preço deve ser maior que zero")
      .max(1_000_000_000, "O preço informado é muito alto"),
    city: z
      .string()
      .trim()
      .min(2, "A cidade é obrigatória")
      .max(100, "A cidade deve ter no máximo 100 caracteres"),
    neighborhood: z
      .string()
      .trim()
      .min(2, "O bairro é obrigatório")
      .max(100, "O bairro deve ter no máximo 100 caracteres"),
    address: nullableText(300),
    type: z.enum(PROPERTY_TYPES, {
      errorMap: () => ({ message: "Tipo de imóvel inválido" }),
    }),
    purpose: z.enum(PROPERTY_PURPOSES, {
      errorMap: () => ({ message: "Finalidade inválida" }),
    }),
    bedrooms: nullableNumber(z.number().int().min(0).max(100)),
    bathrooms: nullableNumber(z.number().int().min(0).max(100)),
    area: nullableNumber(z.number().finite().positive().max(10_000_000)),
    whatsappPhone: z.preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z
        .string()
        .trim()
        .regex(/^\d{10,15}$/, "Use apenas números, com DDI e DDD")
        .nullable()
    ),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    images: z
      .array(propertyImageSchema)
      .min(1, "É necessária pelo menos uma imagem")
      .max(12, "Use no máximo 12 imagens"),
  })
  .strict("O imóvel contém campos não permitidos");

const optionalQueryText = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().trim().min(1).max(max).optional()
  );

const optionalQueryNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().finite().min(0).max(1_000_000_000).optional()
);

export const propertyQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    type: z.enum([...PROPERTY_TYPES, "ALL"] as const).optional(),
    purpose: z.enum([...PROPERTY_PURPOSES, "ALL"] as const).optional(),
    city: optionalQueryText(100),
    search: optionalQueryText(200),
    minPrice: optionalQueryNumber,
    maxPrice: optionalQueryNumber,
    featured: z.enum(["true", "false"]).optional(),
    active: z.enum(["all"]).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      value.minPrice > value.maxPrice
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxPrice"],
        message: "O preço máximo deve ser maior ou igual ao preço mínimo",
      });
    }
  });

export const propertyIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Identificador inválido");

export const propertyStatusSchema = z
  .object({ active: z.boolean() })
  .strict("A atualização contém campos não permitidos");

export function parsePropertyQuery(searchParams: URLSearchParams) {
  const input: Record<string, string | string[]> = Object.create(null);

  for (const [key, value] of searchParams.entries()) {
    const current = input[key];
    input[key] = current === undefined ? value : ([] as string[]).concat(current, value);
  }

  return propertyQuerySchema.safeParse(input);
}

export type PropertyFormData = z.infer<typeof propertySchema>;
export type PropertyQuery = z.infer<typeof propertyQuerySchema>;
