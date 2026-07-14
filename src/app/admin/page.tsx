"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatPrice, propertyTypeLabels } from "@/lib/utils";
import {
  PlusCircle,
  Pencil,
  Trash2,
  Building2,
  Home,
  Landmark,
  MapPin,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

interface Property {
  id: string;
  title: string;
  price: number;
  city: string;
  neighborhood: string;
  type: string;
  purpose: string;
  active: boolean;
  featured: boolean;
  images: { id: string; url: string }[];
  createdAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function fetchProperties() {
    try {
      const res = await fetch("/api/properties?active=all&limit=100");
      const data = await res.json();
      setProperties(data.properties || []);
    } catch {
      console.error("Error fetching properties");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProperties();
  }, []);

  async function deleteProperty(id: string) {
    if (!confirm("Tem certeza que deseja excluir este imóvel?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/properties/${id}`, { method: "DELETE" });
      setProperties((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("Erro ao excluir imóvel");
    } finally {
      setDeleting(null);
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      await fetch(`/api/properties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      setProperties((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active: !currentActive } : p))
      );
    } catch {
      alert("Erro ao atualizar status");
    }
  }

  const totalActive = properties.filter((p) => p.active).length;
  const totalInactive = properties.filter((p) => !p.active).length;

  const typeStats = properties.reduce(
    (acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Gerencie seus imóveis cadastrados
          </p>
        </div>
        <Link
          href="/admin/properties/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium text-sm transition-all hover:opacity-90"
          style={{ background: "#0F172A" }}
        >
          <PlusCircle className="w-4 h-4" />
          Novo Imóvel
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: properties.length, icon: Building2, color: "#0F172A" },
          { label: "Ativos", value: totalActive, icon: Eye, color: "#16a34a" },
          { label: "Inativos", value: totalInactive, icon: EyeOff, color: "#dc2626" },
          {
            label: "Tipos",
            value: Object.keys(typeStats).length,
            icon: Home,
            color: "#0F766E",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-5 rounded-xl"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <stat.icon className="w-6 h-6 mb-2" style={{ color: stat.color }} />
            <div className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              {stat.value}
            </div>
            <div className="text-xs mt-1 font-medium" style={{ color: "var(--text-muted)" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Properties List */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
            Todos os Imóveis
          </h2>
          <span
            className="text-xs px-3 py-1 rounded-full font-medium"
            style={{
              background: "var(--color-badge-type-bg)",
              color: "var(--color-badge-type-text)",
            }}
          >
            {properties.length} {properties.length === 1 ? "imóvel" : "imóveis"}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#0F172A" }} />
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhum imóvel cadastrado
            </p>
            <Link
              href="/admin/properties/new"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-lg text-white font-medium text-sm transition-all"
              style={{ background: "#0F172A" }}
            >
              <PlusCircle className="w-4 h-4" />
              Cadastrar primeiro imóvel
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {properties.map((property) => (
              <div
                key={property.id}
                className="flex items-center gap-4 p-4 sm:p-5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
              >
                {/* Thumbnail */}
                <div className="relative w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--bg-secondary)" }}>
                  {property.images[0] ? (
                    <Image
                      src={property.images[0].url}
                      alt={property.title}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Building2 className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>
                      {property.title}
                    </h3>
                    {!property.active && (
                      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                        Inativo
                      </span>
                    )}
                    {property.featured && (
                      <span
                        className="shrink-0 text-[10px] px-2 py-0.5 rounded font-medium"
                        style={{
                          background: "var(--color-badge-featured-bg)",
                          color: "var(--color-badge-featured-text)",
                        }}
                      >
                        Destaque
                      </span>
                    )}
                    <span
                      className="shrink-0 text-[10px] px-2 py-0.5 rounded font-medium"
                      style={{
                        background: property.purpose === "RENT" ? "var(--color-badge-rent-bg)" : "var(--color-badge-buy-bg)",
                        color: property.purpose === "RENT" ? "var(--color-badge-rent-text)" : "var(--color-badge-buy-text)",
                      }}
                    >
                      {property.purpose === "RENT" ? "Aluguel" : "Venda"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="flex items-center gap-1">
                      <Landmark className="w-3 h-3" />
                      {propertyTypeLabels[property.type] || property.type}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {property.city}
                    </span>
                    <span className="font-bold" style={{ color: "var(--price-color)" }}>
                      {formatPrice(property.price, property.purpose)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(property.id, property.active)}
                    className={`btn-action ${property.active ? "btn-action-warning" : "btn-action-success"}`}
                    aria-label={property.active ? "Desativar" : "Ativar"}
                  >
                    {property.active ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Desativar</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Ativar</span>
                      </>
                    )}
                  </button>
                  <Link
                    href={`/admin/properties/${property.id}/edit`}
                    className="btn-action"
                    aria-label="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </Link>
                  <button
                    onClick={() => deleteProperty(property.id)}
                    disabled={deleting === property.id}
                    className="btn-action btn-action-danger"
                    aria-label="Excluir"
                  >
                    {deleting === property.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Excluir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
