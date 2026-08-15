import "server-only";

import { z } from "zod";

const runtimeEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET deve ter no mínimo 32 caracteres"),
  WHATSAPP_PHONE: z
    .string()
    .regex(/^\d{10,15}$/, "WHATSAPP_PHONE deve conter apenas DDI, DDD e número"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsedEnv = runtimeEnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const problems = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Configuração de ambiente inválida: ${problems}`);
}

export const env = parsedEnv.data;
