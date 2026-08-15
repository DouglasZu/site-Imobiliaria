import "server-only";

import { z } from "zod";

const postgresUrl = z
  .string()
  .min(1, "é obrigatória")
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    } catch {
      return false;
    }
  }, "deve ser uma URL PostgreSQL válida");

const runtimeEnvSchema = z.object({
  DATABASE_URL: postgresUrl,
  DATABASE_ADAPTER: z.enum(["neon", "pg"]).default("neon"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET deve ter no mínimo 32 caracteres"),
  WHATSAPP_PHONE: z
    .string()
    .transform((val) => val.replace(/\D/g, ""))
    .refine((val) => val.length >= 10 && val.length <= 15, {
      message: "WHATSAPP_PHONE deve conter apenas DDI, DDD e número (10 a 15 dígitos)",
    }),
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

export class ServiceConfigurationError extends Error {
  constructor(service: string, issues: readonly z.ZodIssue[]) {
    const fields = [...new Set(issues.map((issue) => issue.path.join(".")))].join(", ");
    super(`Configuração ${service} inválida${fields ? `: ${fields}` : ""}`);
    this.name = "ServiceConfigurationError";
  }
}

function optionalServiceConfig<S extends z.ZodTypeAny>(
  service: string,
  schema: S,
  names: readonly string[]
): z.infer<S> | null {
  const input = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const isEmpty = names.every((name) => !process.env[name]?.trim());
  if (isEmpty) return null;

  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ServiceConfigurationError(service, result.error.issues);
  }
  return result.data;
}

const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().regex(/^[a-f0-9]{32}$/i),
  R2_ACCESS_KEY_ID: z.string().min(16).max(128),
  R2_SECRET_ACCESS_KEY: z.string().min(32).max(256),
  R2_BUCKET_NAME: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/),
  R2_PUBLIC_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), "deve usar HTTPS")
    .refine((value) => {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
    }, "deve conter apenas a origem HTTPS do domínio público")
    .transform((value) => value.replace(/\/+$/, "")),
});

const R2_ENV_NAMES = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

export function getR2Env() {
  return optionalServiceConfig("Cloudflare R2", r2EnvSchema, R2_ENV_NAMES);
}

const resendEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(10).max(256),
  EMAIL_FROM: z.string().min(3).max(320),
  CONTACT_EMAIL: z.string().email().max(254),
});

const RESEND_ENV_NAMES = ["RESEND_API_KEY", "EMAIL_FROM", "CONTACT_EMAIL"] as const;

export function getResendEnv() {
  return optionalServiceConfig("Resend", resendEnvSchema, RESEND_ENV_NAMES);
}

const pusherServerEnvSchema = z
  .object({
    PUSHER_APP_ID: z.string().min(1).max(128),
    PUSHER_SECRET: z.string().min(8).max(256),
    PUSHER_KEY: z.string().min(1).max(128),
    PUSHER_CLUSTER: z.string().regex(/^[a-z0-9-]{2,20}$/),
    NEXT_PUBLIC_PUSHER_KEY: z.string().min(1).max(128),
    NEXT_PUBLIC_PUSHER_CLUSTER: z.string().regex(/^[a-z0-9-]{2,20}$/),
  })
  .superRefine((value, context) => {
    if (value.PUSHER_KEY !== value.NEXT_PUBLIC_PUSHER_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_PUSHER_KEY"],
        message: "deve corresponder a PUSHER_KEY",
      });
    }
    if (value.PUSHER_CLUSTER !== value.NEXT_PUBLIC_PUSHER_CLUSTER) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_PUSHER_CLUSTER"],
        message: "deve corresponder a PUSHER_CLUSTER",
      });
    }
  });

const PUSHER_ENV_NAMES = [
  "PUSHER_APP_ID",
  "PUSHER_SECRET",
  "PUSHER_KEY",
  "PUSHER_CLUSTER",
  "NEXT_PUBLIC_PUSHER_KEY",
  "NEXT_PUBLIC_PUSHER_CLUSTER",
] as const;

export function getPusherServerEnv() {
  return optionalServiceConfig(
    "Pusher",
    pusherServerEnvSchema,
    PUSHER_ENV_NAMES
  );
}

export function getCronSecret(): string | null {
  const value = process.env.CRON_SECRET?.trim();
  if (!value) return null;
  if (value.length < 32) {
    throw new ServiceConfigurationError("Vercel Cron", [
      {
        code: z.ZodIssueCode.custom,
        path: ["CRON_SECRET"],
        message: "deve ter no mínimo 32 caracteres",
      },
    ]);
  }
  return value;
}
