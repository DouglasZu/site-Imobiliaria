import type { Image, PendingUpload, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  getR2PublicUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/r2", () => ({ getR2PublicUrl: mocks.getR2PublicUrl }));

import {
  PropertyImageInputError,
  resolvePropertyImages,
} from "@/lib/storage/property-images";

const existingImage: Image = {
  id: "image-1",
  url: "https://images.example.test/properties/property-1/existing.png",
  storageKey: "properties/property-1/00000000-0000-0000-0000-000000000001.png",
  contentType: "image/png",
  byteSize: 100,
  order: 0,
  propertyId: "property-1",
  createdAt: new Date(),
};

const pendingUpload: PendingUpload = {
  id: "upload-1",
  storageKey: "properties/property-1/00000000-0000-0000-0000-000000000002.png",
  propertyId: "property-1",
  adminId: "admin-1",
  contentType: "image/png",
  byteSize: 100,
  confirmedAt: new Date(),
  signedExpiresAt: new Date(Date.now() + 60_000),
  consumedAt: null,
  cancelledAt: null,
  cleanupAttempts: 0,
  cleanupLastAttemptAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
};

const transaction = {
  pendingUpload: {
    findMany: mocks.findMany,
    updateMany: mocks.updateMany,
  },
} as unknown as Prisma.TransactionClient;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([pendingUpload]);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.getR2PublicUrl.mockReturnValue(
    "https://images.example.test/properties/property-1/upload.png"
  );
});

describe("resolvePropertyImages", () => {
  it("preserva somente imageId realmente pertencente ao imóvel atual", async () => {
    const result = await resolvePropertyImages({
      transaction,
      images: [{ imageId: existingImage.id }],
      propertyId: "property-1",
      adminId: "admin-1",
      existingImages: [existingImage],
    });

    expect(result.resolved[0]).toEqual(
      expect.objectContaining({ id: existingImage.id, storageKey: existingImage.storageKey })
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("rejeita imageId de outro imóvel", async () => {
    await expect(
      resolvePropertyImages({
        transaction,
        images: [{ imageId: existingImage.id }],
        propertyId: "property-2",
        adminId: "admin-1",
        existingImages: [],
      })
    ).rejects.toBeInstanceOf(PropertyImageInputError);
  });

  it("consulta e reivindica upload confirmado pelo mesmo admin e imóvel", async () => {
    const result = await resolvePropertyImages({
      transaction,
      images: [{ uploadId: pendingUpload.id }],
      propertyId: "property-1",
      adminId: "admin-1",
      existingImages: [],
    });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: [pendingUpload.id] },
        propertyId: "property-1",
        adminId: "admin-1",
        confirmedAt: { not: null },
        consumedAt: null,
        cancelledAt: null,
      }),
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: [pendingUpload.id] },
        propertyId: "property-1",
        adminId: "admin-1",
      }),
      data: { consumedAt: expect.any(Date) },
    });
    expect(result.resolved[0]).toEqual(
      expect.objectContaining({ storageKey: pendingUpload.storageKey })
    );
  });

  it("aborta se cancelamento ou outra transação vencer a reivindicação", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      resolvePropertyImages({
        transaction,
        images: [{ uploadId: pendingUpload.id }],
        propertyId: "property-1",
        adminId: "admin-1",
        existingImages: [],
      })
    ).rejects.toBeInstanceOf(PropertyImageInputError);
  });

  it("rejeita o mesmo upload repetido no payload", async () => {
    await expect(
      resolvePropertyImages({
        transaction,
        images: [{ uploadId: pendingUpload.id }, { uploadId: pendingUpload.id }],
        propertyId: "property-1",
        adminId: "admin-1",
        existingImages: [],
      })
    ).rejects.toBeInstanceOf(PropertyImageInputError);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
