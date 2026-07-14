import Link from "next/link";
import { Building2, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#0F172A" }}>
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
                Lar<span style={{ color: "var(--brand-icon)" }} className="dark:text-primary-300">Imóveis</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Encontre o imóvel dos seus sonhos. Casas, apartamentos e terrenos nas melhores localizações.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              Navegação
            </h3>
            <ul className="space-y-3">
              {[
                { href: "/", label: "Início" },
                { href: "/properties", label: "Imóveis" },
                { href: "/properties?type=HOUSE", label: "Casas" },
                { href: "/properties?type=APARTMENT", label: "Apartamentos" },
                { href: "/properties?type=LAND", label: "Terrenos" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors hover:text-primary-900 dark:hover:text-primary-200"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Property Types */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              Tipos de Imóveis
            </h3>
            <ul className="space-y-3">
              {[
                { href: "/properties?type=HOUSE", label: "Casas" },
                { href: "/properties?type=APARTMENT", label: "Apartamentos" },
                { href: "/properties?type=LAND", label: "Terrenos" },
                { href: "/properties?type=COMMERCIAL", label: "Comerciais" },
                { href: "/properties?type=FARM", label: "Chácaras" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors hover:text-primary-900 dark:hover:text-primary-200"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              Contato
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                <Phone className="w-4 h-4 shrink-0" style={{ color: "var(--brand-icon)" }} />
                (11) 99999-9999
              </li>
              <li className="flex items-center gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                <Mail className="w-4 h-4 shrink-0" style={{ color: "var(--brand-icon)" }} />
                contato@larimoveis.com
              </li>
              <li className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--brand-icon)" }} />
                São Paulo, SP — Brasil
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-8 flex items-center justify-center"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            © {new Date().getFullYear()} LarImóveis. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
