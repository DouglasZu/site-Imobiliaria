import { prisma } from "@/lib/prisma";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

// GET /api/properties/cities — Get unique cities from active properties.
export async function GET() {
  try {
    const properties = await prisma.property.groupBy({
      by: ["city"],
      where: { active: true },
      orderBy: { city: "asc" },
    });

    return Response.json(
      properties.map((property) => property.city),
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "properties.cities_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      })
    );

    return Response.json(
      { error: "Erro ao buscar cidades" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
