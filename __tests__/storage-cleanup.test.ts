import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  taskFindMany: vi.fn(),
  taskUpdateMany: vi.fn(),
  taskDeleteMany: vi.fn(),
  taskCreateMany: vi.fn(),
  uploadFindMany: vi.fn(),
  uploadFindUnique: vi.fn(),
  uploadUpdateMany: vi.fn(),
  uploadDeleteMany: vi.fn(),
  imageCount: vi.fn(),
  deleteR2Object: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/r2", () => ({ deleteR2Object: mocks.deleteR2Object }));
vi.mock("@/lib/logging", () => ({ logServerError: mocks.logServerError }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    storageCleanupTask: {
      findMany: mocks.taskFindMany,
      updateMany: mocks.taskUpdateMany,
      deleteMany: mocks.taskDeleteMany,
    },
    pendingUpload: {
      findMany: mocks.uploadFindMany,
      findUnique: mocks.uploadFindUnique,
      updateMany: mocks.uploadUpdateMany,
      deleteMany: mocks.uploadDeleteMany,
    },
    image: { count: mocks.imageCount },
  },
}));

import {
  attemptPendingUploadCleanup,
  attemptStorageCleanup,
  queueStorageCleanup,
} from "@/lib/storage/cleanup";

const storageKey =
  "properties/property-1/00000000-0000-0000-0000-000000000000.png";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.taskFindMany.mockResolvedValue([{ storageKey }]);
  mocks.taskUpdateMany.mockResolvedValue({ count: 1 });
  mocks.taskDeleteMany.mockResolvedValue({ count: 1 });
  mocks.uploadFindMany.mockResolvedValue([]);
  mocks.uploadUpdateMany.mockResolvedValue({ count: 1 });
  mocks.uploadDeleteMany.mockResolvedValue({ count: 1 });
  mocks.imageCount.mockResolvedValue(0);
  mocks.deleteR2Object.mockResolvedValue(undefined);
});

describe("durable R2 cleanup", () => {
  it("enfileira remoção com janela contra replay da URL assinada", async () => {
    const transaction = {
      storageCleanupTask: { createMany: mocks.taskCreateMany },
    } as unknown as Prisma.TransactionClient;
    await queueStorageCleanup(transaction, [storageKey, storageKey]);

    expect(mocks.taskCreateMany).toHaveBeenCalledWith({
      data: [{ storageKey, notBefore: expect.any(Date) }],
      skipDuplicates: true,
    });
    const notBefore = mocks.taskCreateMany.mock.calls[0][0].data[0].notBefore as Date;
    expect(notBefore.getTime()).toBeGreaterThan(Date.now() + 9 * 60 * 1_000);
  });

  it("reivindica a tarefa, revalida referências e então apaga R2", async () => {
    const result = await attemptStorageCleanup([storageKey]);
    expect(result).toEqual({ attempted: 1, removed: 1 });
    expect(mocks.taskUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storageKey }),
        data: { attempts: { increment: 1 }, lastAttemptAt: expect.any(Date) },
      })
    );
    expect(mocks.imageCount).toHaveBeenCalledWith({ where: { storageKey } });
    expect(mocks.deleteR2Object).toHaveBeenCalledWith(storageKey);
    expect(mocks.taskDeleteMany).toHaveBeenCalledWith({ where: { storageKey } });
  });

  it("descarta tarefa obsoleta sem apagar objeto ainda referenciado", async () => {
    mocks.imageCount.mockResolvedValue(1);
    const result = await attemptStorageCleanup([storageKey]);
    expect(result).toEqual({ attempted: 1, removed: 0 });
    expect(mocks.deleteR2Object).not.toHaveBeenCalled();
    expect(mocks.taskDeleteMany).toHaveBeenCalledOnce();
  });

  it("remove tombstone consumido sem apagar a imagem viva", async () => {
    mocks.uploadFindMany.mockResolvedValue([{ id: "upload-1" }]);
    mocks.uploadFindUnique.mockResolvedValue({
      id: "upload-1",
      storageKey,
      consumedAt: new Date(),
    });
    const result = await attemptPendingUploadCleanup();
    expect(result).toEqual({ attempted: 1, removed: 1 });
    expect(mocks.deleteR2Object).not.toHaveBeenCalled();
    expect(mocks.uploadDeleteMany).toHaveBeenCalledWith({ where: { id: "upload-1" } });
  });

  it("apaga objeto cancelado somente quando não há Image referenciando a key", async () => {
    mocks.uploadFindMany.mockResolvedValue([{ id: "upload-1" }]);
    mocks.uploadFindUnique.mockResolvedValue({
      id: "upload-1",
      storageKey,
      consumedAt: null,
    });
    const result = await attemptPendingUploadCleanup();
    expect(result).toEqual({ attempted: 1, removed: 1 });
    expect(mocks.imageCount).toHaveBeenCalledWith({ where: { storageKey } });
    expect(mocks.deleteR2Object).toHaveBeenCalledWith(storageKey);
  });
});
