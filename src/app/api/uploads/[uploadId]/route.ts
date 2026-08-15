import type { NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { jsonNoStore, validateSameOriginRequest } from "@/lib/http-security";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { propertyIdSchema } from "@/lib/schemas/property";
import { deleteR2Object } from "@/lib/storage/r2";

export const maxDuration = 15;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonNoStore({ error: "Não autorizado" }, { status: 401 });
  const originError = validateSameOriginRequest(request);
  if (originError) return originError;

  const parsedId = propertyIdSchema.safeParse((await params).uploadId);
  if (!parsedId.success) return jsonNoStore({ error: "Upload inválido" }, { status: 400 });

  const upload = await prisma.pendingUpload.findFirst({
    where: { id: parsedId.data, adminId: admin.id },
  });
  if (!upload) return jsonNoStore({ error: "Upload não encontrado" }, { status: 404 });

  const claimed = await prisma.pendingUpload.updateMany({
    where: {
      id: upload.id,
      adminId: admin.id,
      consumedAt: null,
      cancelledAt: null,
    },
    data: { confirmedAt: null, cancelledAt: new Date() },
  });
  if (claimed.count !== 1) {
    const current = await prisma.pendingUpload.findUnique({
      where: { id: upload.id },
      select: { consumedAt: true },
    });
    if (current?.consumedAt) {
      return jsonNoStore({ error: "A imagem já está associada ao imóvel" }, { status: 409 });
    }
    return jsonNoStore({ success: true });
  }

  try {
    await deleteR2Object(upload.storageKey);
    return jsonNoStore({ success: true });
  } catch (error) {
    logServerError("r2.pending_upload_delete_failed", error);
    // Cancellation is durable. The cron retries the external delete after the
    // signed URL expires, so a transient R2 failure must not resurrect the item
    // in the form.
    return jsonNoStore({ success: true, cleanupPending: true }, { status: 202 });
  }
}
