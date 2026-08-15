import { z } from "zod";
import { propertyIdSchema } from "@/lib/schemas/property";

export const leadSchema = z
  .object({
    requestId: z.string().uuid(),
    propertyId: propertyIdSchema,
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    phone: z.preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z.string().trim().regex(/^\+?[0-9 ()-]{8,25}$/).nullable()
    ),
    message: z.string().trim().min(10).max(2_000),
    website: z.string().max(200).default(""),
  })
  .strict("O contato contém campos não permitidos");
