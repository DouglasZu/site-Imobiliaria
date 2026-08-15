import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { type NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { jsonNoStore, readJsonBody } from "@/lib/http-security";
import { logServerError } from "@/lib/logging";
import { scheduleAfterResponse } from "@/lib/post-response";
import { prisma } from "@/lib/prisma";
import { ADMIN_EVENTS } from "@/lib/realtime/events";
import { publishAdminEvent } from "@/lib/realtime/server";
import {
  parsePropertyQuery,
  propertyCreateSchema,
} from "@/lib/schemas/property";
import { serializeProperty } from "@/lib/serialization";
import {
  PropertyImageInputError,
  resolvePropertyImages,
} from "@/lib/storage/property-images";

const PROPERTY_BODY_LIMIT = 64 * 1_024;

export async function GET(request: NextRequest) {
  const parsedQuery = parsePropertyQuery(request.nextUrl.searchParams);
  if (!parsedQuery.success) {
    return jsonNoStore(
      { error: parsedQuery.error.issues[0]?.message ?? "Filtros inválidos" },
      { status: 400 }
    );
  }

  try {
    const query = parsedQuery.data;
    const where: Prisma.PropertyWhereInput = {};

    if (query.active === "all") {
      const admin = await getCurrentAdmin();
      if (!admin) where.active = true;
    } else {
      where.active = true;
    }

    if (query.type && query.type !== "ALL") where.type = query.type;
    if (query.purpose && query.purpose !== "ALL") where.purpose = query.purpose;
    if (query.city) where.city = { contains: query.city, mode: "insensitive" };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { city: { contains: query.search, mode: "insensitive" } },
        { neighborhood: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }
    if (query.featured !== undefined) where.featured = query.featured === "true";

    const [properties, total] = await prisma.$transaction([
      prisma.property.findMany({
        where,
        include: { images: { orderBy: { order: "asc" }, take: 1 } },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.property.count({ where }),
    ]);

    return jsonNoStore({
      properties: properties.map(serializeProperty),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    logServerError("properties.list_failed", error);
    return jsonNoStore({ error: "Erro ao buscar imóveis" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonNoStore({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await readJsonBody(request, PROPERTY_BODY_LIMIT);
    if (!body.success) return body.response;
    const result = propertyCreateSchema.safeParse(body.data);
    if (!result.success) {
      return jsonNoStore(
        { error: result.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const { id: requestedId, images, ...propertyData } = result.data;
    const propertyId = requestedId ?? randomUUID();
    const property = await prisma.$transaction(async (transaction) => {
      const resolved = await resolvePropertyImages({
        transaction,
        images,
        propertyId,
        adminId: admin.id,
        existingImages: [],
      });

      await transaction.property.create({
        data: { ...propertyData, id: propertyId, price: propertyData.price.toFixed(2) },
      });
      for (const [order, image] of resolved.resolved.entries()) {
        await transaction.image.create({
          data: { ...image, id: image.id, propertyId, order },
        });
      }
      return transaction.property.findUniqueOrThrow({
        where: { id: propertyId },
        include: { images: { orderBy: { order: "asc" } } },
      });
    });

    scheduleAfterResponse(async () => {
      await publishAdminEvent(ADMIN_EVENTS.propertyCreated, property.id);
    });
    return jsonNoStore(serializeProperty(property), { status: 201 });
  } catch (error) {
    if (error instanceof PropertyImageInputError) {
      return jsonNoStore({ error: error.message }, { status: 400 });
    }
    if (isPrismaCode(error, "P2002")) {
      return jsonNoStore({ error: "Identificador já utilizado" }, { status: 409 });
    }
    logServerError("properties.create_failed", error);
    return jsonNoStore({ error: "Erro ao criar imóvel" }, { status: 500 });
  }
}

function isPrismaCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
