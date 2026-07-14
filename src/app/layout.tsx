import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LarImóveis — Encontre o Imóvel dos Seus Sonhos",
    template: "%s | LarImóveis",
  },
  description:
    "Encontre casas, apartamentos e terrenos nas melhores localizações. Plataforma moderna de imóveis com fotos, preços e contato direto.",
  keywords: ["imóveis", "casas", "apartamentos", "terrenos", "imobiliária", "comprar imóvel"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">
        <Header />
        <main className="flex-1 pt-16 sm:pt-20">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
