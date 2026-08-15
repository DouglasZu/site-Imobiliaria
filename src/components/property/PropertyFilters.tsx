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
  const [citiesUnavailable, setCitiesUnavailable] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/properties/cities")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("cities request failed"))))
      .then((data: unknown) => {
        if (active && Array.isArray(data)) {
          setCities(data.filter((value): value is string => typeof value === "string"));
        }
      })
      .catch(() => {
        if (active) setCitiesUnavailable(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Keep controlled inputs in sync with browser history navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(searchParams.get("search") || "");
    setType(searchParams.get("type") || "ALL");
    setPurpose(searchParams.get("purpose") || "ALL");
    setCity(searchParams.get("city") || "");
    setMinPrice(searchParams.get("minPrice") || "");
    setMaxPrice(searchParams.get("maxPrice") || "");
  }, [searchParams]);

  const applyFilters = useCallback(() => {
    const parsedMinPrice = minPrice === "" ? undefined : Number(minPrice);
    const parsedMaxPrice = maxPrice === "" ? undefined : Number(maxPrice);
    const invalidPrice = [parsedMinPrice, parsedMaxPrice].some(
      (value) => value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1_000_000_000)
    );

    if (invalidPrice) {
      setFilterError("Informe preços entre zero e um bilhão de reais.");
      setShowFilters(true);
      return;
    }
    if (
      parsedMinPrice !== undefined &&
      parsedMaxPrice !== undefined &&
      parsedMinPrice > parsedMaxPrice
    ) {
      setFilterError("O preço máximo deve ser maior ou igual ao preço mínimo.");
      setShowFilters(true);
      return;
    }

    setFilterError("");
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (type && type !== "ALL") params.set("type", type);
    if (purpose && purpose !== "ALL") params.set("purpose", purpose);
    if (city) params.set("city", city);
    if (parsedMinPrice !== undefined) params.set("minPrice", String(parsedMinPrice));
    if (parsedMaxPrice !== undefined) params.set("maxPrice", String(parsedMaxPrice));
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
    setFilterError("");
    router.push("/properties");
  }

  const hasActiveFilters = search || (type && type !== "ALL") || (purpose && purpose !== "ALL") || city || minPrice || maxPrice;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
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
            type="button"
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
            aria-pressed={purpose === tab.value}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5" style={{ color: "var(--text-muted)" }} />
          <label htmlFor="property-search" className="sr-only">
            Buscar por título, cidade ou bairro
          </label>
          <input
            id="property-search"
            name="search"
            type="text"
            placeholder="Buscar por título, cidade ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={200}
            className="w-full pl-12 pr-4 py-3 rounded-lg text-sm transition-all"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
        </div>
        <button
          type="button"
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
          aria-expanded={showFilters}
          aria-controls="property-extra-filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filtros</span>
        </button>
        <button
          type="submit"
          className="px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "#0F172A" }}
        >
          Buscar
        </button>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div id="property-extra-filters" className="mt-4 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-down" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Type */}
          <div>
            <label htmlFor="property-type" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Tipo de Imóvel
            </label>
            <select
              id="property-type"
              name="type"
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
            <label htmlFor="property-city" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Cidade
            </label>
            <select
              id="property-city"
              name="city"
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
            <label htmlFor="property-min-price" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Preço Mínimo
            </label>
            <input
              id="property-min-price"
              name="minPrice"
              type="number"
              min="0"
              max="1000000000"
              step="0.01"
              placeholder="R$ 0"
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value);
                setFilterError("");
              }}
              aria-invalid={Boolean(filterError)}
              aria-describedby={filterError ? "property-filter-error" : undefined}
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
            <label htmlFor="property-max-price" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Preço Máximo
            </label>
            <input
              id="property-max-price"
              name="maxPrice"
              type="number"
              min="0"
              max="1000000000"
              step="0.01"
              placeholder="R$ 999.999"
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value);
                setFilterError("");
              }}
              aria-invalid={Boolean(filterError)}
              aria-describedby={filterError ? "property-filter-error" : undefined}
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
                type="button"
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
      {filterError && (
        <p id="property-filter-error" className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {filterError}
        </p>
      )}
      {citiesUnavailable && (
        <p className="mt-3 text-xs" role="status" style={{ color: "var(--text-muted)" }}>
          A lista de cidades não pôde ser carregada; os demais filtros continuam disponíveis.
        </p>
      )}
    </form>
  );
}
