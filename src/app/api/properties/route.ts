import type { Prisma } from "@prisma/client";
import { type NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { readJsonBody } from "@/lib/http-security";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import {
  parsePropertyQuery,
  propertySchema,
} from "@/lib/schemas/property";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const PROPERTY_BODY_LIMIT = 64 * 1024;

// GET /api/properties — List properties with bounded, validated filters.
export async function GET(request: NextRequest) {
  const parsedQuery = parsePropertyQuery(request.nextUrl.searchParams);

  if (!parsedQuery.success) {
    return Response.json(
      { error: parsedQuery.error.issues[0]?.message ?? "Filtros inválidos" },
      { status: 400, headers: NO_STORE_HEADERS }
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
    if (query.city) where.city = { contains: query.city };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { city: { contains: query.search } },
        { neighborhood: { contains: query.search } },
      ];
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }
    if (query.featured !== undefined) {
      where.featured = query.featured === "true";
    }

    const [properties, total] = await prisma.$transaction([
      prisma.property.findMany({
        where,
        include: {
          images: { orderBy: { order: "asc" }, take: 1 },
        },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.property.count({ where }),
    ]);

    return Response.json(
      {
        properties,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    logServerError("properties.list_failed", error);
    return Response.json(
      { error: "Erro ao buscar imóveis" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

// POST /api/properties — Create a new property (admin only).
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return Response.json(
        { error: "Não autorizado" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

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
    const property = await prisma.property.create({
      data: {
        ...propertyData,
        images: {
          create: images.map((image, order) => ({ url: image.url, order })),
        },
      },
      include: { images: { orderBy: { order: "asc" } } },
    });

    return Response.json(property, {
      status: 201,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    logServerError("properties.create_failed", error);
    return Response.json(
      { error: "Erro ao criar imóvel" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
