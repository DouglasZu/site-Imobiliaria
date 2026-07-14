"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Bed, Bath, Maximize, Heart } from "lucide-react";
import { formatPrice, propertyTypeLabels } from "@/lib/utils";
import { useState, useEffect } from "react";

interface PropertyCardProps {
  property: {
    id: string;
    title: string;
    price: number;
    city: string;
    neighborhood: string;
    type: string;
    purpose?: string;
    bedrooms: number | null;
    bathrooms: number | null;
    area: number | null;
    featured: boolean;
    images: { id: string; url: string }[];
  };
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const mainImage = property.images[0]?.url || "/placeholder-property.jpg";

  useEffect(() => {
    const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
    setIsFavorite(favorites.includes(property.id));
  }, [property.id]);

  function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
    const updated = isFavorite
      ? favorites.filter((id: string) => id !== property.id)
      : [...favorites, property.id];
    localStorage.setItem("favorites", JSON.stringify(updated));
    setIsFavorite(!isFavorite);
  }

  return (
    <Link href={`/properties/${property.id}`} className="group block">
      <article
        className="property-card rounded-[14px] overflow-hidden h-full flex flex-col"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Image — Prioritized, clean, large */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image
            src={mainImage}
            alt={property.title}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />

          {/* Favorite button — subtle, top-right */}
          <button
            onClick={toggleFavorite}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/90 dark:bg-gray-900/70 backdrop-blur-sm transition-all hover:scale-110"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
            aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isFavorite ? "fill-red-500 text-red-500" : "text-gray-500 dark:text-gray-300"
              }`}
            />
          </button>

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
          {property.images.length > 1 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 text-white text-[10px] font-medium backdrop-blur-sm">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              {property.images.length}
            </div>
          )}
        </div>

        {/* Content — Clean, generous spacing */}
        <div className="p-5 flex-1 flex flex-col">
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
        </div>
      </article>
    </Link>
  );
}
