"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  LayoutDashboard,
  PlusCircle,
  Pencil,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  // Don't show sidebar on login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout failed");
      router.push("/admin/login");
      router.refresh();
    } catch {
      setLogoutError("Não foi possível encerrar a sessão. Tente novamente.");
      setLoggingOut(false);
    }
  }

  const isEditing = pathname.includes("/edit");
  const links = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/properties/new", label: "Novo Imóvel", icon: PlusCircle },
    ...(isEditing ? [{ href: pathname, label: "Editar Imóvel", icon: Pencil }] : []),
  ];

  return (
    <div className="flex min-h-screen -mt-16 sm:-mt-20">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu administrativo"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        aria-label="Menu administrativo"
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-0 h-screen w-64 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)" }}
      >
        {/* Sidebar header */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#0F172A" }}>
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
              Admin
            </span>
          </div>
          <button
            type="button"
            aria-label="Fechar menu administrativo"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1" aria-label="Navegação administrativa">
          {links.map((link) => {
            const isActive = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  isActive ? "active" : ""
                }`}
                style={isActive ? {} : { color: "var(--text-secondary)" }}
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronLeft className="w-5 h-5" />
            Ver Site
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400"
          >
            <LogOut className="w-5 h-5" />
            {loggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div
          className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
          style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}
        >
          <button
            type="button"
            aria-label="Abrir menu administrativo"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Administração
          </span>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {logoutError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {logoutError}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
