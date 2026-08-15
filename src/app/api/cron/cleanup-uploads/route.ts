import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getCronSecret, getR2Env, ServiceConfigurationError } from "@/lib/env";
import { jsonNoStore } from "@/lib/http-security";
import { retryDueLeadNotifications } from "@/lib/leads/notifications";
import { logServerError } from "@/lib/logging";
import {
  attemptPendingUploadCleanup,
  attemptStorageCleanup,
  findDueStorageCleanupKeys,
} from "@/lib/storage/cleanup";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const secret = getCronSecret();
    if (!secret || !isAuthorized(request.headers.get("authorization"), secret)) {
      return jsonNoStore({ error: "Não autorizado" }, { status: 401 });
    }

    const r2Configured = Boolean(getR2Env());
    const [leadNotifications, storage] = await Promise.all([
      retryDueLeadNotifications(),
      r2Configured ? runStorageCleanup() : Promise.resolve(null),
    ]);

    return jsonNoStore({
      r2Configured,
      cleanupTasksAttempted: storage?.tasks.attempted ?? 0,
      cleanupTasksRemoved: storage?.tasks.removed ?? 0,
      expiredUploadsAttempted: storage?.uploads.attempted ?? 0,
      pendingUploadsRemoved: storage?.uploads.removed ?? 0,
      leadNotificationsAttempted: leadNotifications.attempted,
      leadNotificationsSent: leadNotifications.sent,
    });
  } catch (error) {
    logServerError("maintenance.cron_failed", error);
    const status = error instanceof ServiceConfigurationError ? 503 : 500;
    return jsonNoStore({ error: "Falha na manutenção agendada" }, { status });
  }
}

async function runStorageCleanup() {
  // The R2 layer aborts each complete SDK operation after eight seconds. With
  // concurrency 20, five waves cover 100 items per queue within maxDuration.
  const keys = await findDueStorageCleanupKeys(100);
  const [tasks, uploads] = await Promise.all([
    attemptStorageCleanup(keys),
    attemptPendingUploadCleanup(100),
  ]);
  return { tasks, uploads };
}

function isAuthorized(header: string | null, secret: string) {
  if (!header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
