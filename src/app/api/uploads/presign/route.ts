import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { ServiceConfigurationError, getR2Env } from "@/lib/env";
import { jsonNoStore, readJsonBody } from "@/lib/http-security";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { consumeUploadRateLimit, getClientIp } from "@/lib/rate-limit";
import { presignUploadSchema } from "@/lib/schemas/upload";
import { createR2PresignedPut } from "@/lib/storage/r2";

const BODY_LIMIT = 4 * 1_024;
const PENDING_UPLOAD_TTL_MS = 24 * 60 * 60 * 1_000;

const extensionByType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonNoStore({ error: "Não autorizado" }, { status: 401 });

  try {
    if (!getR2Env()) {
      return jsonNoStore({ error: "Upload indisponível" }, { status: 503 });
    }

    const body = await readJsonBody(request, BODY_LIMIT);
    if (!body.success) return body.response;
    const parsed = presignUploadSchema.safeParse(body.data);
    if (!parsed.success) {
      return jsonNoStore(
        { error: parsed.error.issues[0]?.message ?? "Upload inválido" },
        { status: 400 }
      );
    }

    const rateLimit = await consumeUploadRateLimit({
      ip: getClientIp(request),
      adminId: admin.id,
    });
    if (!rateLimit.allowed) {
      return jsonNoStore(
        { error: "Muitos uploads. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const now = new Date();
    const pendingCount = await prisma.pendingUpload.count({
      where: {
        propertyId: parsed.data.propertyId,
        adminId: admin.id,
        consumedAt: null,
        cancelledAt: null,
        expiresAt: { gt: now },
      },
    });
    if (pendingCount >= 12) {
      return jsonNoStore({ error: "Limite de imagens atingido" }, { status: 409 });
    }

    const uploadId = randomUUID();
    const storageKey = `properties/${parsed.data.propertyId}/${randomUUID()}.${
      extensionByType[parsed.data.contentType]
    }`;
    const expiresAt = new Date(now.getTime() + PENDING_UPLOAD_TTL_MS);

    await prisma.pendingUpload.create({
      data: {
        id: uploadId,
        storageKey,
        propertyId: parsed.data.propertyId,
        adminId: admin.id,
        contentType: parsed.data.contentType,
        byteSize: parsed.data.size,
        expiresAt,
      },
    });

    try {
      const signed = await createR2PresignedPut({
        storageKey,
        propertyId: parsed.data.propertyId,
        uploadId,
        contentType: parsed.data.contentType,
        byteSize: parsed.data.size,
      });
      await prisma.pendingUpload.update({
        where: { id: uploadId },
        data: { signedExpiresAt: signed.expiresAt },
      });
      return jsonNoStore({ uploadId, ...signed });
    } catch (error) {
      await prisma.pendingUpload.deleteMany({ where: { id: uploadId, adminId: admin.id } });
      throw error;
    }
  } catch (error) {
    logServerError("r2.presign_failed", error);
    const status = error instanceof ServiceConfigurationError ? 503 : 500;
    return jsonNoStore({ error: "Upload indisponível" }, { status });
  }
}
