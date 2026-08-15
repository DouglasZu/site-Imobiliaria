import { notFound } from "next/navigation";
import Link from "next/link";
import { findPropertyById, findRelatedProperties } from "@/lib/queries/property";
import { formatPrice, propertyTypeLabels, getWhatsAppLink } from "@/lib/utils";
import { env } from "@/lib/env";
import { isAllowedPropertyImageUrl } from "@/lib/image-policy";
import ImageGallery from "@/components/property/ImageGallery";
import PropertyCard from "@/components/property/PropertyCard";
import PropertyMap from "@/components/property/PropertyMap";
import {
  ArrowLeft,
  Bed,
  Bath,
  Maximize,
  MapPin,
  Home,
  Calendar,
} from "lucide-react";
import ShareButton from "@/components/property/ShareButton";
import type { Metadata } from "next";

interface PropertyPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { id } = await params;
  const property = await findPropertyById(id);

  if (!property) {
    return {
      title: "Imóvel não encontrado",
      robots: { index: false, follow: false },
    };
  }

  const description = `${property.title} em ${property.city} por ${formatPrice(property.price.toString(), property.purpose)}. ${property.description.slice(0, 120)}`;
  const image = property.images.find((item) => isAllowedPropertyImageUrl(item.url));

  return {
    title: property.title,
    description,
    alternates: { canonical: `/properties/${property.id}` },
    openGraph: {
      type: "article",
      title: property.title,
      description,
      url: `/properties/${property.id}`,
      images: image ? [{ url: image.url, alt: property.title }] : undefined,
    },
  };
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { id } = await params;

  const property = await findPropertyById(id);

  if (!property) notFound();

  // Fetch related properties (same type or city, excluding this one)
  const related = await findRelatedProperties(property);

  const whatsappLink = getWhatsAppLink(
    property.title,
    property.whatsappPhone || env.WHATSAPP_PHONE
  );
  const allowedImages = property.images.filter((image) =>
    isAllowedPropertyImageUrl(image.url)
  );

  const specs = [
    property.bedrooms && { icon: Bed, label: `${property.bedrooms} ${property.bedrooms === 1 ? "Quarto" : "Quartos"}` },
    property.bathrooms && { icon: Bath, label: `${property.bathrooms} ${property.bathrooms === 1 ? "Banheiro" : "Banheiros"}` },
    property.area && { icon: Maximize, label: `${property.area}m²` },
    { icon: Home, label: propertyTypeLabels[property.type] || property.type },
  ].filter(Boolean) as { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string }[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Back button */}
      <Link
        href="/properties"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors hover:text-primary-900 dark:hover:text-primary-200"
        style={{ color: "var(--text-muted)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar aos imóveis
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
        {/* Left: Images + Description */}
        <div className="lg:col-span-3 space-y-8">
          <ImageGallery images={allowedImages} title={property.title} />

          {/* Description */}
          <div
            className="rounded-xl p-6 sm:p-8"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text)" }}>
              Descrição
            </h2>
            <div
              className="text-sm leading-relaxed whitespace-pre-line"
              style={{ color: "var(--text-secondary)" }}
            >
              {property.description}
            </div>
          </div>

          {/* Map */}
          <div
            className="rounded-xl p-6 sm:p-8"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text)" }}>
              Localização
            </h2>
            <div className="flex items-center gap-2 mb-4" style={{ color: "var(--text-muted)" }}>
              <MapPin className="w-4 h-4" />
              <span className="text-sm">
                {property.neighborhood}, {property.city}
                {property.address && ` — ${property.address}`}
              </span>
            </div>
            <PropertyMap
              city={property.city}
              neighborhood={property.neighborhood}
              title={property.title}
              address={property.address || undefined}
            />
          </div>
        </div>

        {/* Right: Info Sidebar */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price + Title Card */}
          <div
            className="rounded-xl p-6 sm:p-8 sticky top-24"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {/* Type/Purpose badges — Pastel, small */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider"
                style={{
                  background: "var(--color-badge-type-bg)",
                  color: "var(--color-badge-type-text)",
                }}
              >
                {propertyTypeLabels[property.type] || property.type}
              </span>
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider"
                style={{
                  background: property.purpose === "RENT" ? "var(--color-badge-rent-bg)" : "var(--color-badge-buy-bg)",
                  color: property.purpose === "RENT" ? "var(--color-badge-rent-text)" : "var(--color-badge-buy-text)",
                }}
              >
                {property.purpose === "RENT" ? "Aluguel" : "Comprar"}
              </span>
              {property.featured && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider"
                  style={{
                    background: "var(--color-badge-featured-bg)",
                    color: "var(--color-badge-featured-text)",
                  }}
                >
                  Destaque
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-3" style={{ color: "var(--text)" }}>
              {property.title}
            </h1>

            <div className="flex items-center gap-1.5 mb-6" style={{ color: "var(--text-muted)" }}>
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="text-sm">
                {property.neighborhood}, {property.city}
              </span>
            </div>

            {/* Price — Largest visual element, green */}
            <div
              className="text-3xl sm:text-4xl font-bold mb-6 pb-6 tracking-tight"
              style={{ color: "var(--price-color)", borderBottom: "1px solid var(--border)" }}
            >
              {formatPrice(property.price.toString(), property.purpose)}
            </div>

            {/* Specs grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex items-center gap-2.5 p-3 rounded-lg"
                  style={{ background: "var(--bg-secondary)" }}
                >
                  <spec.icon className="w-4.5 h-4.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {spec.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Date */}
            <div className="flex items-center gap-2 mb-6 text-xs" style={{ color: "var(--text-muted)" }}>
              <Calendar className="w-3.5 h-3.5" />
              Publicado em {new Date(property.createdAt).toLocaleDateString("pt-BR")}
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-6 py-4 rounded-xl bg-green-700 text-white font-semibold text-base hover:bg-green-800 transition-all duration-300"
                style={{ boxShadow: "0 4px 12px rgba(22, 163, 74, 0.2)" }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Falar no WhatsApp
              </a>
              <ShareButton />
            </div>
          </div>
        </div>
      </div>

      {/* Related Properties */}
      {related.length > 0 && (
        <section className="mt-16 sm:mt-20">
          <h2 className="text-2xl font-bold tracking-tight mb-8" style={{ color: "var(--text)" }}>
            Imóveis Similares
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {related.map((prop) => (
              <PropertyCard key={prop.id} property={{ ...prop, price: prop.price.toString() }} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
