import Link from "next/link";
import Image from "next/image";
import { MapPin, Bed, Bath, Maximize, Building2 } from "lucide-react";
import { formatPrice, propertyTypeLabels } from "@/lib/utils";
import { isAllowedPropertyImageUrl } from "@/lib/image-policy";
import FavoriteButton from "@/components/property/FavoriteButton";

interface PropertyCardProps {
  property: {
    id: string;
    title: string;
    price: number | string;
    city: string;
    neighborhood: string;
    type: string;
    purpose?: string;
    bedrooms: number | null;
    bathrooms: number | null;
    area: number | null;
    featured: boolean;
    images: { id: string; url: string }[];
    _count?: { images: number };
  };
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const mainImage = property.images.find((image) => isAllowedPropertyImageUrl(image.url))?.url;
  const imageCount = property._count?.images ?? property.images.length;

  return (
    <article
      className="property-card group rounded-[14px] overflow-hidden h-full flex flex-col"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
        {/* Image — Prioritized, clean, large */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <Link
            href={`/properties/${property.id}`}
            aria-label={`Ver detalhes de ${property.title}`}
            className="block h-full"
          >
            {mainImage ? (
              <Image
                src={mainImage}
                alt={property.title}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <span className="flex h-full items-center justify-center" style={{ background: "var(--bg-secondary)" }}>
                <Building2 className="h-10 w-10" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                <span className="sr-only">Sem imagem disponível</span>
              </span>
            )}

            {/* Featured badge — small, top-left, subtle gold */}
            {property.featured && (
              <div className="absolute top-3 left-3">
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    background: "var(--color-badge-featured-bg)",
                    color: "var(--color-badge-featured-text)",
                  }}
                >
                  Destaque
                </span>
              </div>
            )}

            {/* Image count indicator */}
            {imageCount > 1 && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 text-white text-[10px] font-medium backdrop-blur-sm">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                {imageCount}
              </div>
            )}
          </Link>

          {/* Favorite button — separate from the property link */}
          <FavoriteButton propertyId={property.id} />
        </div>

        {/* Content — Clean, generous spacing */}
        <Link href={`/properties/${property.id}`} className="p-5 flex-1 flex flex-col">
          {/* Badges — Small, pastel, non-competing */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: "var(--color-badge-type-bg)",
                color: "var(--color-badge-type-text)",
              }}
            >
              {propertyTypeLabels[property.type] || property.type}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: property.purpose === "RENT" ? "var(--color-badge-rent-bg)" : "var(--color-badge-buy-bg)",
                color: property.purpose === "RENT" ? "var(--color-badge-rent-text)" : "var(--color-badge-buy-text)",
              }}
            >
              {property.purpose === "RENT" ? "Aluguel" : "Comprar"}
            </span>
          </div>

          {/* Price — Largest visual element, green for value */}
          <div
            className="text-xl sm:text-2xl font-bold mb-2 tracking-tight"
            style={{ color: "var(--price-color)" }}
          >
            {formatPrice(property.price, property.purpose)}
          </div>

          {/* Title — Bold, clear */}
          <h3
            className="font-bold text-[15px] leading-snug line-clamp-2 mb-2 group-hover:text-primary-900 dark:group-hover:text-primary-200 transition-colors"
            style={{ color: "var(--text)" }}
          >
            {property.title}
          </h3>

          {/* Location — Muted, with subtle icon */}
          <div className="flex items-center gap-1.5 mb-4" style={{ color: "var(--text-muted)" }}>
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[13px] truncate">
              {property.neighborhood}, {property.city}
            </span>
          </div>

          {/* Specs — Clean divider, bottom-aligned */}
          <div
            className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-auto pt-3 min-h-[40px] text-[13px]"
            style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            {property.bedrooms != null && property.bedrooms > 0 && (
              <div className="flex items-center gap-1.5">
                <Bed className="w-3.5 h-3.5" />
                <span>{property.bedrooms} {property.bedrooms === 1 ? "quarto" : "quartos"}</span>
              </div>
            )}
            {property.bathrooms != null && property.bathrooms > 0 && (
              <div className="flex items-center gap-1.5">
                <Bath className="w-3.5 h-3.5" />
                <span>{property.bathrooms} {property.bathrooms === 1 ? "banheiro" : "banheiros"}</span>
              </div>
            )}
            {property.area != null && property.area > 0 && (
              <div className="flex items-center gap-1.5">
                <Maximize className="w-3.5 h-3.5" />
                <span>{property.area}m²</span>
              </div>
            )}
          </div>
        </Link>
    </article>
  );
}
