import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import PropertyCard from "@/components/property/PropertyCard";
import PropertyFilters from "@/components/property/PropertyFilters";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Imóveis",
  description: "Explore nossa seleção de casas, apartamentos e terrenos disponíveis nas melhores localizações.",
};

interface PropertiesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function PropertyList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const page = parseInt((searchParams.page as string) || "1");
  const limit = 12;
  const type = searchParams.type as string | undefined;
  const purpose = searchParams.purpose as string | undefined;
  const city = searchParams.city as string | undefined;
  const search = searchParams.search as string | undefined;
  const minPrice = searchParams.minPrice as string | undefined;
  const maxPrice = searchParams.maxPrice as string | undefined;

  // Build Prisma where clause
  const where: Record<string, unknown> = { active: true };

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

  const totalPages = Math.ceil(total / limit);

  // Build pagination URL params
  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (type && type !== "ALL") params.set("type", type);
    if (purpose && purpose !== "ALL") params.set("purpose", purpose);
    if (city) params.set("city", city);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    params.set("page", p.toString());
    return `/properties?${params.toString()}`;
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-20 rounded-xl" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}>
        <Building2 className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
        <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text)" }}>
          Nenhum imóvel encontrado
        </h3>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Tente ajustar os filtros para encontrar mais resultados
        </p>
        <Link
          href="/properties"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-all hover:opacity-90"
          style={{ background: "#0F172A" }}
        >
          Limpar filtros
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Results count */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text)" }}>{total}</strong> {total === 1 ? "imóvel encontrado" : "imóveis encontrados"}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={pageUrl(page - 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Link>
          )}

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span className="px-2" style={{ color: "var(--text-muted)" }}>...</span>
                )}
                <Link
                  href={pageUrl(p)}
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                    p === page
                      ? "text-white"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  style={p === page ? { background: "#0F172A" } : { color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  {p}
                </Link>
              </span>
            ))}

          {page < totalPages && (
            <Link
              href={pageUrl(page + 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </>
  );
}

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  const resolvedParams = await searchParams;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Imóveis Disponíveis
        </h1>
        <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--text-muted)" }}>
          Encontre o imóvel perfeito para você
        </p>
      </div>

      <Suspense fallback={null}>
        <PropertyFilters />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="skeleton aspect-[16/10]" />
                <div className="p-5 space-y-3">
                  <div className="skeleton h-5 w-3/4 rounded" />
                  <div className="skeleton h-4 w-1/2 rounded" />
                  <div className="skeleton h-4 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        <PropertyList searchParams={resolvedParams} />
      </Suspense>
    </div>
  );
}
