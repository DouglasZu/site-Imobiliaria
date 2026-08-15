import Link from "next/link";
import { findProperties, countProperties, getDistinctCities } from "@/lib/queries/property";
import PropertyCard from "@/components/property/PropertyCard";
import { Building2, Home, MapPin, ArrowRight, Search, Shield } from "lucide-react";
import { env } from "@/lib/env";
import { getWhatsAppLink } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Property inventory is runtime database data and must not be queried while building.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featuredProperties, totalCount, cities] = await Promise.all([
    findProperties({ active: true }, 0, 6),
    countProperties({ active: true }),
    getDistinctCities(),
  ]);
  const whatsappLink = getWhatsAppLink("os imóveis disponíveis", env.WHATSAPP_PHONE);

  return (
    <div>
      {/* ===== Hero Section — Refined Navy ===== */}
      <section className="relative overflow-hidden gradient-hero">
        {/* Subtle light accents */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-white/[0.02] blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] border border-white/[0.1] mb-6 animate-fade-in">
              <Shield className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/60 font-medium">Portal imobiliário de confiança</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight text-balance animate-slide-up">
              Encontre o imóvel{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/90 to-white/50">
                dos seus sonhos
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed animate-slide-up">
              Explore casas, apartamentos e terrenos nas melhores localizações.
              Encontre o lugar perfeito para chamar de lar.
            </p>

            {/* Search CTA */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
              <Link
                href="/properties"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-white text-primary-900 font-semibold text-base hover:bg-gray-50 hover:scale-[1.01] transition-all duration-300"
                style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.1)" }}
              >
                <Search className="w-5 h-5" />
                Explorar Imóveis
              </Link>
              <Link
                href="/properties?type=HOUSE"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-white/[0.08] text-white font-semibold text-base border border-white/[0.12] hover:bg-white/[0.14] transition-all duration-300"
              >
                <Home className="w-5 h-5" />
                Ver Casas
              </Link>
            </div>
          </div>
        </div>

        {/* Wave transition */}
        <div className="absolute -bottom-px left-0 right-0">
          <svg
            viewBox="0 0 1440 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full block"
            preserveAspectRatio="none"
          >
            <path
              d="M0 60H1440V30C1440 30 1320 0 1080 15C840 30 720 45 480 30C240 15 120 0 0 15V60Z"
              fill="var(--bg)"
            />
          </svg>
        </div>
      </section>

      {/* ===== Stats Section ===== */}
      <section className="py-12 sm:py-16" style={{ background: "var(--bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { value: `${totalCount}`, label: "Imóveis Disponíveis", icon: Building2 },
              { value: `${cities.length}`, label: "Cidades Atendidas", icon: MapPin },
              { value: "5", label: "Tipos de Imóveis", icon: Home },
              { value: "2", label: "Compra e Aluguel", icon: Search },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center p-6 rounded-xl transition-all duration-300"
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <stat.icon className="w-7 h-7 mx-auto mb-3" style={{ color: "var(--brand-icon)" }} />
                <div className="text-2xl sm:text-3xl font-bold" style={{ color: "var(--text)" }}>
                  {stat.value}
                </div>
                <div className="text-xs mt-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Featured Properties ===== */}
      <section className="py-12 sm:py-20" style={{ background: "var(--bg-secondary)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
                Imóveis em Destaque
              </h2>
              <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--text-muted)" }}>
                Confira anúncios em destaque e as publicações mais recentes
              </p>
            </div>
            <Link
              href="/properties"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: "var(--brand-icon)" }}
            >
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {featuredProperties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {featuredProperties.map((property) => (
                <PropertyCard key={property.id} property={{ ...property, price: property.price.toString() }} />
              ))}
            </div>
          ) : (
            <div
              className="text-center py-20 rounded-xl"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
              }}
            >
              <Building2 className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>
                Nenhum imóvel cadastrado ainda
              </h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Em breve teremos novos imóveis disponíveis
              </p>
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/properties"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: "var(--brand-icon)" }}
            >
              Ver todos os imóveis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== CTA Section ===== */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="relative overflow-hidden rounded-2xl px-6 py-16 sm:px-16 sm:py-20 text-center"
            style={{ background: "#0F172A" }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/[0.04] blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-white/[0.03] blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
                Pronto para encontrar seu próximo lar?
              </h2>
              <p className="mt-4 text-lg text-white/50 max-w-xl mx-auto">
                Entre em contato conosco e encontre o imóvel perfeito para você e sua família.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/properties"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-primary-900 font-semibold text-base hover:bg-gray-50 transition-all duration-300"
                  style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}
                >
                  <Search className="w-5 h-5" />
                  Explorar Imóveis
                </Link>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-green-700 text-white font-semibold text-base hover:bg-green-800 transition-all duration-300"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Falar no WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
