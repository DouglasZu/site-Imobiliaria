import { z } from "zod";
import {
  PROPERTY_IMAGE_CONTENT_TYPES,
  PROPERTY_IMAGE_MAX_BYTES,
} from "@/lib/image-policy";
import { propertyIdSchema } from "@/lib/schemas/property";

export const presignUploadSchema = z
  .object({
    propertyId: propertyIdSchema,
    contentType: z.enum(PROPERTY_IMAGE_CONTENT_TYPES),
    size: z.coerce.number().int().min(1).max(PROPERTY_IMAGE_MAX_BYTES),
  })
  .strict("O upload contém campos não permitidos");

export const uploadIdBodySchema = z
  .object({ uploadId: propertyIdSchema })
  .strict("O upload contém campos não permitidos");
