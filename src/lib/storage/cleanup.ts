import "server-only";

import type { Prisma } from "@prisma/client";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/storage/r2";

const SIGNED_URL_REPLAY_GRACE_MS = 10 * 60 * 1_000;
const CLEANUP_RETRY_DELAY_MS = 15 * 60 * 1_000;
const CLEANUP_CONCURRENCY = 20;

export async function queueStorageCleanup(
  transaction: Prisma.TransactionClient,
  storageKeys: readonly string[]
) {
  const uniqueKeys = [...new Set(storageKeys)];
  if (uniqueKeys.length === 0) return;
  const now = Date.now();
  await transaction.storageCleanupTask.createMany({
    data: uniqueKeys.map((storageKey) => ({
      storageKey,
      // An object must remain present while its presigned PUT could still be
      // replayed; If-None-Match then prevents recreation after deletion.
      notBefore: new Date(now + SIGNED_URL_REPLAY_GRACE_MS),
    })),
    skipDuplicates: true,
  });
}

export async function findDueStorageCleanupKeys(limit = 100) {
  const now = new Date();
  const retryCutoff = new Date(now.getTime() - CLEANUP_RETRY_DELAY_MS);
  const tasks = await prisma.storageCleanupTask.findMany({
    where: {
      notBefore: { lte: now },
      OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lte: retryCutoff } }],
    },
    orderBy: [
      { lastAttemptAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ],
    take: Math.min(Math.max(limit, 1), 100),
    select: { storageKey: true },
  });
  return tasks.map((task) => task.storageKey);
}

export async function attemptStorageCleanup(storageKeys: readonly string[]) {
  const uniqueKeys = [...new Set(storageKeys)];
  if (uniqueKeys.length === 0) return { attempted: 0, removed: 0 };

  const now = new Date();
  const retryCutoff = new Date(now.getTime() - CLEANUP_RETRY_DELAY_MS);
  const dueTasks = await prisma.storageCleanupTask.findMany({
    where: {
      storageKey: { in: uniqueKeys },
      notBefore: { lte: now },
      OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lte: retryCutoff } }],
    },
    select: { storageKey: true },
  });

  let removed = 0;
  await forEachConcurrent(dueTasks, CLEANUP_CONCURRENCY, async ({ storageKey }) => {
    const claimed = await prisma.storageCleanupTask.updateMany({
      where: {
        storageKey,
        notBefore: { lte: now },
        OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lte: retryCutoff } }],
      },
      data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
    });
    if (claimed.count !== 1) return;

    try {
      // A stale task must never delete an object that is referenced again.
      const references = await prisma.image.count({ where: { storageKey } });
      if (references > 0) {
        await prisma.storageCleanupTask.deleteMany({ where: { storageKey } });
        return;
      }
      await deleteR2Object(storageKey);
      await prisma.storageCleanupTask.deleteMany({ where: { storageKey } });
      removed += 1;
    } catch (error) {
      logServerError("r2.cleanup_failed", error);
    }
  });

  return { attempted: dueTasks.length, removed };
}

export async function attemptPendingUploadCleanup(limit = 100) {
  const now = new Date();
  const retryCutoff = new Date(now.getTime() - CLEANUP_RETRY_DELAY_MS);
  const unsignedFallbackCutoff = new Date(
    now.getTime() - SIGNED_URL_REPLAY_GRACE_MS
  );
  const uploads = await prisma.pendingUpload.findMany({
    where: {
      OR: [
        { consumedAt: { not: null } },
        { cancelledAt: { not: null } },
        { expiresAt: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { signedExpiresAt: { lte: now } },
            { signedExpiresAt: null, createdAt: { lte: unsignedFallbackCutoff } },
          ],
        },
        {
          OR: [
            { cleanupLastAttemptAt: null },
            { cleanupLastAttemptAt: { lte: retryCutoff } },
          ],
        },
      ],
    },
    orderBy: [
      { cleanupLastAttemptAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ],
    take: Math.min(Math.max(limit, 1), 100),
    select: { id: true },
  });

  let removed = 0;
  await forEachConcurrent(uploads, CLEANUP_CONCURRENCY, async ({ id }) => {
    const claimTime = new Date();
    const claimed = await prisma.pendingUpload.updateMany({
      where: {
        id,
        OR: [
          { cleanupLastAttemptAt: null },
          { cleanupLastAttemptAt: { lte: retryCutoff } },
        ],
      },
      data: {
        cleanupAttempts: { increment: 1 },
        cleanupLastAttemptAt: claimTime,
      },
    });
    if (claimed.count !== 1) return;

    const upload = await prisma.pendingUpload.findUnique({ where: { id } });
    if (!upload) return;

    try {
      if (!upload.consumedAt) {
        const references = await prisma.image.count({
          where: { storageKey: upload.storageKey },
        });
        if (references === 0) await deleteR2Object(upload.storageKey);
      }
      await prisma.pendingUpload.deleteMany({ where: { id: upload.id } });
      removed += 1;
    } catch (error) {
      logServerError("r2.pending_upload_cleanup_failed", error);
    }
  });

  return { attempted: uploads.length, removed };
}

async function forEachConcurrent<T>(
  values: readonly T[],
  concurrency: number,
  task: (value: T) => Promise<void>
) {
  for (let index = 0; index < values.length; index += concurrency) {
    await Promise.all(values.slice(index, index + concurrency).map(task));
  }
}
