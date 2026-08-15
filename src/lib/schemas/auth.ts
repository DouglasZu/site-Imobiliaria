import { z } from "zod";

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("E-mail inválido")
      .max(254, "E-mail inválido")
      .transform((email) => email.toLowerCase()),
    password: z
      .string()
      .min(1, "Informe a senha")
      .max(72, "Credenciais inválidas")
      .refine(
        (password) => new TextEncoder().encode(password).byteLength <= 72,
        "Credenciais inválidas"
      ),
  })
  .strict("A requisição contém campos não permitidos");

export type LoginFormData = z.infer<typeof loginSchema>;
