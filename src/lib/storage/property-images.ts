import "server-only";

import type { Image, Prisma } from "@prisma/client";
import { getR2PublicUrl } from "@/lib/storage/r2";
import type { PropertyImageInput } from "@/lib/schemas/property";

export class PropertyImageInputError extends Error {
  constructor(message = "Imagem inválida ou não autorizada") {
    super(message);
    this.name = "PropertyImageInputError";
  }
}

export interface ResolvedPropertyImage {
  id?: string;
  url: string;
  storageKey: string | null;
  contentType: string | null;
  byteSize: number | null;
}

export async function resolvePropertyImages(input: {
  transaction: Prisma.TransactionClient;
  images: readonly PropertyImageInput[];
  propertyId: string;
  adminId: string;
  existingImages: readonly Image[];
}) {
  const existingById = new Map(input.existingImages.map((image) => [image.id, image]));
  const uploadIds = input.images.flatMap((image) =>
    "uploadId" in image ? [image.uploadId] : []
  );
  const uniqueUploadIds = new Set(uploadIds);
  if (uniqueUploadIds.size !== uploadIds.length) throw new PropertyImageInputError();

  const pendingUploads = uniqueUploadIds.size
    ? await input.transaction.pendingUpload.findMany({
        where: {
          id: { in: [...uniqueUploadIds] },
          propertyId: input.propertyId,
          adminId: input.adminId,
          confirmedAt: { not: null },
          consumedAt: null,
          cancelledAt: null,
          expiresAt: { gt: new Date() },
        },
      })
    : [];
  const pendingById = new Map(pendingUploads.map((upload) => [upload.id, upload]));
  if (pendingById.size !== uniqueUploadIds.size) throw new PropertyImageInputError();

  if (uniqueUploadIds.size > 0) {
    // Claim every upload inside the same transaction that writes Image rows.
    // Cancellation and another save use the same conditional write, so only
    // one operation can own the object.
    const claimed = await input.transaction.pendingUpload.updateMany({
      where: {
        id: { in: [...uniqueUploadIds] },
        propertyId: input.propertyId,
        adminId: input.adminId,
        confirmedAt: { not: null },
        consumedAt: null,
        cancelledAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== uniqueUploadIds.size) throw new PropertyImageInputError();
  }

  const usedExistingIds = new Set<string>();
  const resolved: ResolvedPropertyImage[] = input.images.map((image) => {
    if ("url" in image) {
      return {
        url: image.url,
        storageKey: null,
        contentType: null,
        byteSize: null,
      };
    }

    if ("imageId" in image) {
      if (usedExistingIds.has(image.imageId)) throw new PropertyImageInputError();
      const existing = existingById.get(image.imageId);
      if (!existing) throw new PropertyImageInputError();
      usedExistingIds.add(image.imageId);
      return {
        id: existing.id,
        url: existing.url,
        storageKey: existing.storageKey,
        contentType: existing.contentType,
        byteSize: existing.byteSize,
      };
    }

    const upload = pendingById.get(image.uploadId);
    if (!upload) throw new PropertyImageInputError();
    return {
      url: getR2PublicUrl(upload.storageKey),
      storageKey: upload.storageKey,
      contentType: upload.contentType,
      byteSize: upload.byteSize,
    };
  });

  return { resolved };
}
