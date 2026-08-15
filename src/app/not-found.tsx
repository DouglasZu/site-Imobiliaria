import Link from "next/link";
import { Building2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <Building2 className="mb-5 h-12 w-12" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
      <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--brand-icon)" }}>
        Erro 404
      </p>
      <h1 className="mt-2 text-2xl font-bold" style={{ color: "var(--text)" }}>
        Página não encontrada
      </h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        O endereço pode estar incorreto ou o imóvel não está mais disponível.
      </p>
      <Link
        href="/properties"
        className="mt-6 rounded-lg px-5 py-3 text-sm font-semibold text-white"
        style={{ background: "#0F172A" }}
      >
        Ver imóveis disponíveis
      </Link>
    </div>
  );
}
