import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

// GET /api/properties — List properties with filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const type = searchParams.get("type");
    const purpose = searchParams.get("purpose");
    const city = searchParams.get("city");
    const search = searchParams.get("search");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const featured = searchParams.get("featured");
    const active = searchParams.get("active");

    const where: Record<string, unknown> = {};

    // Only admins can see inactive properties
    if (active === "all") {
      const admin = await getCurrentAdmin();
      if (!admin) {
        // Non-admins always see only active properties
        where.active = true;
      }
      // admins: no filter applied, sees all
    } else {
      where.active = true;
    }

    if (type && type !== "ALL") {
      where.type = type;
    }

    if (purpose && purpose !== "ALL") {
      where.purpose = purpose;
    }

    if (city) {
      where.city = { contains: city };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { city: { contains: search } },
        { neighborhood: { contains: search } },
      ];
    }

    if (minPrice) {
      where.price = { ...(where.price as object || {}), gte: parseFloat(minPrice) };
    }

    if (maxPrice) {
      where.price = { ...(where.price as object || {}), lte: parseFloat(maxPrice) };
    }

    if (featured === "true") {
      where.featured = true;
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: { images: { orderBy: { order: "asc" } } },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    return Response.json({
      properties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return Response.json(
      { error: "Erro ao buscar imóveis" },
      { status: 500 }
    );
  }
}

// POST /api/properties — Create a new property (admin only)
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    const data = await request.json();
    const {
      title,
      description,
      price,
      city,
      neighborhood,
      address,
      type,
      purpose,
      bedrooms,
      bathrooms,
      area,
      whatsappPhone,
      featured,
      active,
      images,
    } = data;

    if (!title || !description || !price || !city || !neighborhood || !type) {
      return Response.json(
        { error: "Campos obrigatórios não preenchidos" },
        { status: 400 }
      );
    }

    const property = await prisma.property.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        city,
        neighborhood,
        address: address || null,
        type,
        purpose: purpose || "SALE",
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseInt(bathrooms) : null,
        area: area ? parseFloat(area) : null,
        whatsappPhone: whatsappPhone || null,
        featured: featured || false,
        active: active !== false,
        images: images?.length
          ? {
              create: images.map((img: { url: string; publicId?: string }, index: number) => ({
                url: img.url,
                publicId: img.publicId || "",
                order: index,
              })),
            }
          : undefined,
      },
      include: { images: true },
    });

    return Response.json(property, { status: 201 });
  } catch (error) {
    console.error("Error creating property:", error);
    return Response.json(
      { error: "Erro ao criar imóvel" },
      { status: 500 }
    );
  }
}
