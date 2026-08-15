import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "LarImóveis — Encontre o Imóvel dos Seus Sonhos",
    template: "%s | LarImóveis",
  },
  description:
    "Encontre casas, apartamentos e terrenos nas melhores localizações. Plataforma moderna de imóveis com fotos, preços e contato direto.",
  keywords: ["imóveis", "casas", "apartamentos", "terrenos", "imobiliária", "comprar imóvel"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "LarImóveis",
    title: "LarImóveis — Encontre o Imóvel dos Seus Sonhos",
    description: "Encontre casas, apartamentos e terrenos nas melhores localizações.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Proxy attaches a fresh CSP nonce to every document request.
  await connection();

  return (
    <html lang="pt-BR" className="h-full" suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">
        <a
          href="#main-content"
          className="sr-only z-[200] rounded-lg bg-white px-4 py-3 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Pular para o conteúdo principal
        </a>
        <Header />
        <main id="main-content" tabIndex={-1} className="flex-1 pt-16 sm:pt-20">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
