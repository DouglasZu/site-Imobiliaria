import { prisma } from "@/lib/prisma";

// GET /api/properties/cities — Get unique cities
export async function GET() {
  try {
    const properties = await prisma.property.findMany({
      where: { active: true },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    });

    const cities = properties.map((p) => p.city);

    return Response.json(cities);
  } catch {
    return Response.json({ error: "Erro ao buscar cidades" }, { status: 500 });
  }
}
