import { Suspense } from "react";
import { findProperties, countProperties } from "@/lib/queries/property";
import { PropertyWhereInput } from "@/types";
import PropertyCard from "@/components/property/PropertyCard";
import PropertyFilters from "@/components/property/PropertyFilters";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { Prisma } from "@prisma/client";

const PROPERTY_TYPES = ["HOUSE", "APARTMENT", "LAND", "COMMERCIAL", "FARM"] as const;
const PROPERTY_PURPOSES = ["SALE", "RENT"] as const;

export const metadata: Metadata = {
  title: "Imóveis",
  description: "Explore nossa seleção de casas, apartamentos e terrenos disponíveis nas melhores localizações.",
  alternates: { canonical: "/properties" },
  openGraph: {
    title: "Imóveis disponíveis",
    description: "Explore nossa seleção de casas, apartamentos e terrenos disponíveis.",
    url: "/properties",
  },
};

interface PropertiesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getScalarParam(value: string | string[] | undefined, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function getPriceParam(value: string | string[] | undefined) {
  const rawValue = getScalarParam(value, 20);
  if (!rawValue) return undefined;
  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 1_000_000_000
    ? parsedValue
    : undefined;
}

async function PropertyList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const parsedPage = Number(getScalarParam(searchParams.page, 5));
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 10_000
    ? parsedPage
    : 1;
  const limit = 12;
  const rawType = getScalarParam(searchParams.type, 20);
  const rawPurpose = getScalarParam(searchParams.purpose, 20);
  const type = PROPERTY_TYPES.includes(rawType as (typeof PROPERTY_TYPES)[number])
    ? (rawType as (typeof PROPERTY_TYPES)[number])
    : undefined;
  const purpose = PROPERTY_PURPOSES.includes(rawPurpose as (typeof PROPERTY_PURPOSES)[number])
    ? (rawPurpose as (typeof PROPERTY_PURPOSES)[number])
    : undefined;
  const city = getScalarParam(searchParams.city, 100);
  const search = getScalarParam(searchParams.search, 200);
  const minPrice = getPriceParam(searchParams.minPrice);
  const maxPrice = getPriceParam(searchParams.maxPrice);

  // Build Prisma where clause using strongly typed input
  const where: PropertyWhereInput = { active: true };

  if (type) {
    where.type = type;
  }
  if (purpose) {
    where.purpose = purpose;
  }
  if (city) {
    where.city = { contains: city, mode: "insensitive" };
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { neighborhood: { contains: search, mode: "insensitive" } },
    ];
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter: Prisma.DecimalFilter = {};
    if (minPrice !== undefined) priceFilter.gte = minPrice;
    if (maxPrice !== undefined) priceFilter.lte = maxPrice;
    where.price = priceFilter;
  }

  const skip = (page - 1) * limit;

  const [properties, total] = await Promise.all([
    findProperties(where, skip, limit),
    countProperties(where),
  ]);

  const totalPages = Math.ceil(total / limit);
  const visiblePages = [...new Set([
    1,
    totalPages,
    page - 2,
    page - 1,
    page,
    page + 1,
    page + 2,
  ])]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((left, right) => left - right);

  // Build pagination URL params
  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (type) params.set("type", type);
    if (purpose) params.set("purpose", purpose);
    if (city) params.set("city", city);
    if (minPrice !== undefined) params.set("minPrice", minPrice.toString());
    if (maxPrice !== undefined) params.set("maxPrice", maxPrice.toString());
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
          <PropertyCard key={property.id} property={{ ...property, price: property.price.toString() }} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Paginação de imóveis">
          {page > 1 && (
            <Link
              href={pageUrl(page - 1)}
              rel="prev"
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Anterior
            </Link>
          )}

          {visiblePages.map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span className="px-2" style={{ color: "var(--text-muted)" }} aria-hidden="true">...</span>
                )}
                <Link
                  href={pageUrl(p)}
                  aria-label={`Página ${p}`}
                  aria-current={p === page ? "page" : undefined}
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
              rel="next"
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              Próximo
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          )}
        </nav>
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
