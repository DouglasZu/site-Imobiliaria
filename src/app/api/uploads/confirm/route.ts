import type { NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { ServiceConfigurationError } from "@/lib/env";
import { jsonNoStore, readJsonBody } from "@/lib/http-security";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { consumeUploadRateLimit, getClientIp } from "@/lib/rate-limit";
import { uploadIdBodySchema } from "@/lib/schemas/upload";
import {
  InvalidR2ImageError,
  deleteR2Object,
  getR2PublicUrl,
  verifyR2Image,
} from "@/lib/storage/r2";
import type { PropertyImageContentType } from "@/lib/image-policy";

class UploadStateConflictError extends Error {}

export const maxDuration = 20;

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonNoStore({ error: "Não autorizado" }, { status: 401 });

  const body = await readJsonBody(request, 4 * 1_024);
  if (!body.success) return body.response;
  const parsed = uploadIdBodySchema.safeParse(body.data);
  if (!parsed.success) return jsonNoStore({ error: "Upload inválido" }, { status: 400 });

  try {
    const upload = await prisma.pendingUpload.findFirst({
      where: {
        id: parsed.data.uploadId,
        adminId: admin.id,
        consumedAt: null,
        cancelledAt: null,
      },
    });
    if (!upload) return jsonNoStore({ error: "Upload não encontrado" }, { status: 404 });

    if (upload.expiresAt <= new Date()) {
      await deleteInvalidUpload(upload.id, upload.storageKey, admin.id);
      return jsonNoStore({ error: "Upload expirado" }, { status: 410 });
    }

    // R2 objects are immutable through the issued If-None-Match URL. Avoid
    // downloading and decoding the same confirmed image again on retries.
    if (upload.confirmedAt) {
      return jsonNoStore({
        image: { uploadId: upload.id, url: getR2PublicUrl(upload.storageKey) },
      });
    }

    const rateLimit = await consumeUploadRateLimit({
      ip: getClientIp(request),
      adminId: admin.id,
    });
    if (!rateLimit.allowed) {
      return jsonNoStore(
        { error: "Muitas validações de upload. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    await verifyR2Image({
      storageKey: upload.storageKey,
      propertyId: upload.propertyId,
      uploadId: upload.id,
      contentType: upload.contentType as PropertyImageContentType,
      byteSize: upload.byteSize,
    });
    const confirmed = await prisma.pendingUpload.updateMany({
      where: {
        id: upload.id,
        adminId: admin.id,
        consumedAt: null,
        cancelledAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { confirmedAt: upload.confirmedAt ?? new Date() },
    });
    if (confirmed.count !== 1) throw new UploadStateConflictError();

    return jsonNoStore({
      image: { uploadId: upload.id, url: getR2PublicUrl(upload.storageKey) },
    });
  } catch (error) {
    if (error instanceof InvalidR2ImageError) {
      const upload = await prisma.pendingUpload.findFirst({
        where: { id: parsed.data.uploadId, adminId: admin.id },
      });
      if (upload) await deleteInvalidUpload(upload.id, upload.storageKey, admin.id);
      return jsonNoStore({ error: "Arquivo de imagem inválido" }, { status: 400 });
    }
    if (error instanceof UploadStateConflictError) {
      return jsonNoStore(
        { error: "O upload foi cancelado ou já foi associado" },
        { status: 409 }
      );
    }
    logServerError("r2.confirm_failed", error);
    const status = error instanceof ServiceConfigurationError ? 503 : 502;
    return jsonNoStore({ error: "Não foi possível confirmar o upload" }, { status });
  }
}

async function deleteInvalidUpload(id: string, storageKey: string, adminId: string) {
  const claimed = await prisma.pendingUpload.updateMany({
    where: { id, adminId, consumedAt: null },
    data: { confirmedAt: null, cancelledAt: new Date() },
  });
  if (claimed.count !== 1) return;

  try {
    await deleteR2Object(storageKey);
  } catch (error) {
    logServerError("r2.invalid_upload_cleanup_failed", error);
  }
}
