"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, Home, Building2, Moon, Sun } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("theme");
    } catch {
      // System preference remains available when storage is blocked.
    }
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      // Initialize browser-only persisted state after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Theme still applies for the current page when storage is unavailable.
    }
  }

  const links = [
    { href: "/", label: "Início", icon: Home },
    { href: "/properties", label: "Imóveis", icon: Building2 },
  ];

  const isAdmin = pathname.startsWith("/admin") && pathname !== "/admin/login";

  return (
    <header
      className={`${isAdmin ? "relative" : "fixed top-0 left-0 right-0"} z-50 transition-all duration-300 ${
        isAdmin
          ? ""
          : scrolled
            ? "glass shadow-sm"
            : "bg-transparent"
      }`}
      style={isAdmin ? { background: "var(--sidebar-bg)", borderBottom: "1px solid var(--border)" } : undefined}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo — Navy brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-shadow" style={{ background: "#0F172A" }}>
              <Building2 className="w-5 h-5 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Lar<span style={{ color: "var(--brand-icon)" }} className="dark:text-primary-300">Imóveis</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
            {links.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  style={
                    isActive
                      ? { background: "#0F172A" }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={toggleTheme}
              className="ml-2 p-2.5 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--text-muted)" }}
              aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
              aria-pressed={dark}
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </nav>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--text-muted)" }}
              aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
              aria-pressed={dark}
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--text-secondary)" }}
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav id="mobile-navigation" className="md:hidden animate-slide-down" aria-label="Navegação móvel" style={{ background: "var(--card-bg)", borderTop: "1px solid var(--border)" }}>
          <div className="px-4 py-3 space-y-1">
            {links.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive ? "text-white" : ""
                  }`}
                  style={
                    isActive
                      ? { background: "#0F172A" }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
