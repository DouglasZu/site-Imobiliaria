import { type NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import {
  readJsonBody,
  validateSameOriginRequest,
} from "@/lib/http-security";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import {
  propertyIdSchema,
  propertySchema,
  propertyStatusSchema,
} from "@/lib/schemas/property";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const PROPERTY_BODY_LIMIT = 64 * 1024;

function isMissingRecord(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  );
}

function invalidIdResponse() {
  return Response.json(
    { error: "Identificador inválido" },
    { status: 400, headers: NO_STORE_HEADERS }
  );
}

// GET /api/properties/[id]
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

    if (!property) {
      return Response.json(
        { error: "Imóvel não encontrado" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (!property.active && !(await getCurrentAdmin())) {
      return Response.json(
        { error: "Imóvel não encontrado" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return Response.json(property, { headers: NO_STORE_HEADERS });
  } catch (error) {
    logServerError("properties.get_failed", error);
    return Response.json(
      { error: "Erro ao buscar imóvel" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

// PUT /api/properties/[id] — Replace a property (admin only).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await getCurrentAdmin())) {
      return Response.json(
        { error: "Não autorizado" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const parsedId = propertyIdSchema.safeParse((await params).id);
    if (!parsedId.success) return invalidIdResponse();

    const body = await readJsonBody(request, PROPERTY_BODY_LIMIT);
    if (!body.success) return body.response;

    const result = propertySchema.safeParse(body.data);
    if (!result.success) {
      return Response.json(
        { error: result.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const { images, ...propertyData } = result.data;
    const property = await prisma.property.update({
      where: { id: parsedId.data },
      data: {
        ...propertyData,
        images: {
          deleteMany: {},
          create: images.map((image, order) => ({ url: image.url, order })),
        },
      },
      include: { images: { orderBy: { order: "asc" } } },
    });

    return Response.json(property, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (isMissingRecord(error)) {
      return Response.json(
        { error: "Imóvel não encontrado" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    logServerError("properties.update_failed", error);
    return Response.json(
      { error: "Erro ao atualizar imóvel" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

// PATCH /api/properties/[id] — Update administrative status only.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await getCurrentAdmin())) {
      return Response.json(
        { error: "Não autorizado" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const parsedId = propertyIdSchema.safeParse((await params).id);
    if (!parsedId.success) return invalidIdResponse();

    const body = await readJsonBody(request, 8 * 1024);
    if (!body.success) return body.response;

    const result = propertyStatusSchema.safeParse(body.data);
    if (!result.success) {
      return Response.json(
        { error: result.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const property = await prisma.property.update({
      where: { id: parsedId.data },
      data: result.data,
      include: { images: { orderBy: { order: "asc" }, take: 1 } },
    });

    return Response.json(property, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (isMissingRecord(error)) {
      return Response.json(
        { error: "Imóvel não encontrado" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    logServerError("properties.status_update_failed", error);
    return Response.json(
      { error: "Erro ao atualizar status" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

// DELETE /api/properties/[id] — Delete (admin only).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await getCurrentAdmin())) {
      return Response.json(
        { error: "Não autorizado" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const parsedId = propertyIdSchema.safeParse((await params).id);
    if (!parsedId.success) return invalidIdResponse();

    const originError = validateSameOriginRequest(request);
    if (originError) return originError;

    await prisma.property.delete({ where: { id: parsedId.data } });

    return Response.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (isMissingRecord(error)) {
      return Response.json(
        { error: "Imóvel não encontrado" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    logServerError("properties.delete_failed", error);
    return Response.json(
      { error: "Erro ao excluir imóvel" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
