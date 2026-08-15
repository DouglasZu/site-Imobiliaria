import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesso administrativo",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
