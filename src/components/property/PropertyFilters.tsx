"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { propertyTypeLabels, propertyTypes } from "@/lib/utils";

export default function PropertyFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [type, setType] = useState(searchParams.get("type") || "ALL");
  const [purpose, setPurpose] = useState(searchParams.get("purpose") || "ALL");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [cities, setCities] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetch("/api/properties/cities")
      .then((res) => res.json())
      .then((data) => setCities(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setType(searchParams.get("type") || "ALL");
    setPurpose(searchParams.get("purpose") || "ALL");
    setCity(searchParams.get("city") || "");
    setMinPrice(searchParams.get("minPrice") || "");
    setMaxPrice(searchParams.get("maxPrice") || "");
  }, [searchParams]);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (type && type !== "ALL") params.set("type", type);
    if (purpose && purpose !== "ALL") params.set("purpose", purpose);
    if (city) params.set("city", city);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    params.set("page", "1");

    router.push(`/properties?${params.toString()}`);
  }, [search, type, purpose, city, minPrice, maxPrice, router]);

  function clearFilters() {
    setSearch("");
    setType("ALL");
    setPurpose("ALL");
    setCity("");
    setMinPrice("");
    setMaxPrice("");
    router.push("/properties");
  }

  const hasActiveFilters = search || (type && type !== "ALL") || (purpose && purpose !== "ALL") || city || minPrice || maxPrice;

  return (
    <div
      className="rounded-xl p-4 sm:p-6 mb-8"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Purpose Segment Tabs */}
      <div className="flex gap-1.5 mb-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        {[
          { value: "ALL", label: "Todos os Imóveis" },
          { value: "SALE", label: "Comprar" },
          { value: "RENT", label: "Alugar" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setPurpose(tab.value);
              const params = new URLSearchParams(searchParams.toString());
              if (tab.value === "ALL") {
                params.delete("purpose");
              } else {
                params.set("purpose", tab.value);
              }
              params.set("page", "1");
              router.push(`/properties?${params.toString()}`);
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              purpose === tab.value
                ? "text-white"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            style={
              purpose === tab.value
                ? { background: "#0F172A" }
                : { color: "var(--text-muted)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Buscar por título, cidade ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="w-full pl-12 pr-4 py-3 rounded-lg text-sm transition-all"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            showFilters || hasActiveFilters
              ? "text-white"
              : ""
          }`}
          style={
            showFilters || hasActiveFilters
              ? { background: "#0F172A" }
              : { background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text-secondary)" }
          }
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filtros</span>
        </button>
        <button
          onClick={applyFilters}
          className="px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "#0F172A" }}
        >
          Buscar
        </button>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="mt-4 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-down" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Type */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Tipo de Imóvel
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            >
              <option value="ALL">Todos os tipos</option>
              {propertyTypes.map((t) => (
                <option key={t} value={t}>
                  {propertyTypeLabels[t]}
                </option>
              ))}
            </select>
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Cidade
            </label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            >
              <option value="">Todas as cidades</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Min Price */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Preço Mínimo
            </label>
            <input
              type="number"
              placeholder="R$ 0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Preço Máximo
            </label>
            <input
              type="number"
              placeholder="R$ 999.999"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all hover:bg-red-50 dark:hover:bg-red-950/20"
                style={{ color: "var(--color-danger)" }}
              >
                <X className="w-4 h-4" />
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
