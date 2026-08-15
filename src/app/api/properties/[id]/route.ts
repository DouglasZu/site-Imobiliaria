import { type NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { jsonNoStore, readJsonBody, validateSameOriginRequest } from "@/lib/http-security";
import { logServerError } from "@/lib/logging";
import { scheduleAfterResponse } from "@/lib/post-response";
import { prisma } from "@/lib/prisma";
import { ADMIN_EVENTS } from "@/lib/realtime/events";
import { publishAdminEvent } from "@/lib/realtime/server";
import {
  propertyIdSchema,
  propertyStatusSchema,
  propertyUpdateSchema,
  propertyVersionSchema,
} from "@/lib/schemas/property";
import { serializeProperty } from "@/lib/serialization";
import { attemptStorageCleanup, queueStorageCleanup } from "@/lib/storage/cleanup";
import {
  PropertyImageInputError,
  resolvePropertyImages,
} from "@/lib/storage/property-images";

const PROPERTY_BODY_LIMIT = 64 * 1_024;

class PropertyNotFoundError extends Error {}
class PropertyConflictError extends Error {}

function isMissingRecord(error: unknown) {
  return error instanceof PropertyNotFoundError || isPrismaCode(error, "P2025");
}

function invalidIdResponse() {
  return jsonNoStore({ error: "Identificador inválido" }, { status: 400 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsedId = propertyIdSchema.safeParse((await params).id);
  if (!parsedId.success) return invalidIdResponse();

  try {
    const property = await prisma.property.findUnique({
      where: { id: parsedId.data },
      include: { images: { orderBy: { order: "asc" } } },
    });
    if (!property || (!property.active && !(await getCurrentAdmin()))) {
      return jsonNoStore({ error: "Imóvel não encontrado" }, { status: 404 });
    }
    return jsonNoStore(serializeProperty(property));
  } catch (error) {
    logServerError("properties.get_failed", error);
    return jsonNoStore({ error: "Erro ao buscar imóvel" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonNoStore({ error: "Não autorizado" }, { status: 401 });
  const parsedId = propertyIdSchema.safeParse((await params).id);
  if (!parsedId.success) return invalidIdResponse();

  try {
    const body = await readJsonBody(request, PROPERTY_BODY_LIMIT);
    if (!body.success) return body.response;
    const result = propertyUpdateSchema.safeParse(body.data);
    if (!result.success) {
      return jsonNoStore(
        { error: result.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const { images, version, ...propertyData } = result.data;
    const resultWithCleanup = await prisma.$transaction(async (transaction) => {
      const current = await transaction.property.findUnique({
        where: { id: parsedId.data },
        include: { images: { orderBy: { order: "asc" } } },
      });
      if (!current) throw new PropertyNotFoundError();
      if (current.version !== version) throw new PropertyConflictError();

      const resolved = await resolvePropertyImages({
        transaction,
        images,
        propertyId: current.id,
        adminId: admin.id,
        existingImages: current.images,
      });
      const retainedKeys = new Set(
        resolved.resolved.flatMap((image) => (image.storageKey ? [image.storageKey] : []))
      );
      const removedStorageKeys = current.images.flatMap((image) =>
        image.storageKey && !retainedKeys.has(image.storageKey) ? [image.storageKey] : []
      );
      await queueStorageCleanup(transaction, removedStorageKeys);

      const updated = await transaction.property.updateMany({
        where: { id: current.id, version },
        data: {
          ...propertyData,
          price: propertyData.price.toFixed(2),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new PropertyConflictError();
      await transaction.image.deleteMany({ where: { propertyId: current.id } });
      for (const [order, image] of resolved.resolved.entries()) {
        await transaction.image.create({
          data: { ...image, id: image.id, propertyId: current.id, order },
        });
      }
      const property = await transaction.property.findUniqueOrThrow({
        where: { id: current.id },
        include: { images: { orderBy: { order: "asc" } } },
      });
      return { property, removedStorageKeys };
    });

    scheduleAfterResponse(async () => {
      await Promise.all([
        attemptStorageCleanup(resultWithCleanup.removedStorageKeys),
        publishAdminEvent(ADMIN_EVENTS.propertyUpdated, resultWithCleanup.property.id),
      ]);
    });
    return jsonNoStore(serializeProperty(resultWithCleanup.property));
  } catch (error) {
    if (isMissingRecord(error)) {
      return jsonNoStore({ error: "Imóvel não encontrado" }, { status: 404 });
    }
    if (error instanceof PropertyImageInputError) {
      return jsonNoStore({ error: error.message }, { status: 400 });
    }
    if (error instanceof PropertyConflictError) {
      return jsonNoStore(
        { error: "O imóvel foi alterado em outra sessão. Recarregue antes de salvar." },
        { status: 409 }
      );
    }
    logServerError("properties.update_failed", error);
    return jsonNoStore({ error: "Erro ao atualizar imóvel" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonNoStore({ error: "Não autorizado" }, { status: 401 });
  const parsedId = propertyIdSchema.safeParse((await params).id);
  if (!parsedId.success) return invalidIdResponse();

  try {
    const body = await readJsonBody(request, 8 * 1_024);
    if (!body.success) return body.response;
    const result = propertyStatusSchema.safeParse(body.data);
    if (!result.success) {
      return jsonNoStore(
        { error: result.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }
    const { version, active } = result.data;
    const updated = await prisma.property.updateMany({
      where: { id: parsedId.data, version },
      data: { active, version: { increment: 1 } },
    });
    if (updated.count !== 1) {
      const exists = await prisma.property.count({ where: { id: parsedId.data } });
      if (exists === 0) throw new PropertyNotFoundError();
      throw new PropertyConflictError();
    }
    const property = await prisma.property.findUniqueOrThrow({
      where: { id: parsedId.data },
      include: { images: { orderBy: { order: "asc" }, take: 1 } },
    });
    scheduleAfterResponse(async () => {
      await publishAdminEvent(ADMIN_EVENTS.propertyUpdated, property.id);
    });
    return jsonNoStore(serializeProperty(property));
  } catch (error) {
    if (isMissingRecord(error)) {
      return jsonNoStore({ error: "Imóvel não encontrado" }, { status: 404 });
    }
    if (error instanceof PropertyConflictError) {
      return jsonNoStore(
        { error: "O imóvel foi alterado em outra sessão. Recarregue e tente novamente." },
        { status: 409 }
      );
    }
    logServerError("properties.status_update_failed", error);
    return jsonNoStore({ error: "Erro ao atualizar status" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonNoStore({ error: "Não autorizado" }, { status: 401 });
  const parsedId = propertyIdSchema.safeParse((await params).id);
  if (!parsedId.success) return invalidIdResponse();
  const originError = validateSameOriginRequest(request);
  if (originError) return originError;
  const parsedVersion = propertyVersionSchema.safeParse(request.headers.get("if-match"));
  if (!parsedVersion.success) {
    return jsonNoStore(
      { error: "A versão atual do imóvel é obrigatória" },
      { status: 428 }
    );
  }

  try {
    const storageKeys = await prisma.$transaction(async (transaction) => {
      const property = await transaction.property.findUnique({
        where: { id: parsedId.data },
        select: { version: true, images: { select: { storageKey: true } } },
      });
      if (!property) throw new PropertyNotFoundError();
      if (property.version !== parsedVersion.data) throw new PropertyConflictError();
      const keys = property.images.flatMap((image) =>
        image.storageKey ? [image.storageKey] : []
      );
      await queueStorageCleanup(transaction, keys);
      const deleted = await transaction.property.deleteMany({
        where: { id: parsedId.data, version: parsedVersion.data },
      });
      if (deleted.count !== 1) throw new PropertyConflictError();
      return keys;
    });

    scheduleAfterResponse(async () => {
      await Promise.all([
        attemptStorageCleanup(storageKeys),
        publishAdminEvent(ADMIN_EVENTS.propertyDeleted, parsedId.data),
      ]);
    });
    return jsonNoStore({ success: true });
  } catch (error) {
    if (isMissingRecord(error)) {
      return jsonNoStore({ error: "Imóvel não encontrado" }, { status: 404 });
    }
    if (error instanceof PropertyConflictError) {
      return jsonNoStore(
        { error: "O imóvel foi alterado em outra sessão. Recarregue antes de excluir." },
        { status: 409 }
      );
    }
    logServerError("properties.delete_failed", error);
    return jsonNoStore({ error: "Erro ao excluir imóvel" }, { status: 500 });
  }
}

function isPrismaCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
