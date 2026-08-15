"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPrice, propertyTypeLabels } from "@/lib/utils";
import { isRenderablePropertyImage } from "@/lib/image-policy";
import { subscribeToAdminEvents } from "@/lib/realtime/client";
import { ADMIN_EVENTS } from "@/lib/realtime/events";
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
  version: number;
  title: string;
  price: number | string;
  city: string;
  neighborhood: string;
  type: string;
  purpose: string;
  active: boolean;
  featured: boolean;
  images: { id: string; url: string; storageKey?: string | null }[];
  createdAt: string;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  propertyTitle: string;
  status: "NEW" | "CONTACTED" | "ARCHIVED";
  notificationStatus: "PENDING" | "SENT" | "FAILED" | "UNKNOWN" | "DISABLED";
  createdAt: string;
}

interface LeadPagination {
  page: number;
  total: number;
  totalPages: number;
}

const notificationStatusLabels: Record<Lead["notificationStatus"], string> = {
  PENDING: "E-mail pendente",
  SENT: "E-mail enviado",
  FAILED: "Falha no e-mail",
  UNKNOWN: "Envio incerto",
  DISABLED: "E-mail desativado",
};

type PendingAction = "toggle" | "delete";

async function getResponseError(response: Response, fallback: string) {
  const payload: unknown = await response.json().catch(() => null);
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

function getMainImageUrl(property: Property) {
  return property.images.find(isRenderablePropertyImage)?.url;
}

export default function AdminDashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [realtimeNotice, setRealtimeNotice] = useState("");
  const [leadError, setLeadError] = useState("");
  const [leadPagination, setLeadPagination] = useState<LeadPagination>({
    page: 1,
    total: 0,
    totalPages: 0,
  });
  const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [pendingActions, setPendingActions] = useState<Record<string, PendingAction>>({});
  const pendingIds = useRef(new Set<string>());

  function setPendingAction(id: string, action?: PendingAction) {
    setPendingActions((previous) => {
      const next = { ...previous };
      if (action) next[id] = action;
      else delete next[id];
      return next;
    });
  }

  const fetchProperties = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError("");
    try {
      const loadedProperties: Property[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const res = await fetch(`/api/properties?active=all&limit=50&page=${page}`);
        if (!res.ok) {
          throw new Error(await getResponseError(res, "Não foi possível carregar os imóveis."));
        }

        const data: unknown = await res.json();
        if (
          !data ||
          typeof data !== "object" ||
          !("properties" in data) ||
          !Array.isArray(data.properties) ||
          !("pagination" in data) ||
          !data.pagination ||
          typeof data.pagination !== "object" ||
          !("totalPages" in data.pagination) ||
          typeof data.pagination.totalPages !== "number" ||
          !Number.isInteger(data.pagination.totalPages) ||
          data.pagination.totalPages < 0 ||
          data.pagination.totalPages > 10_000
        ) {
          throw new Error("A resposta da listagem de imóveis é inválida.");
        }

        loadedProperties.push(...(data.properties as Property[]));
        totalPages = data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      setProperties(loadedProperties);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar os imóveis.");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  const fetchLeads = useCallback(async (page = 1, append = false) => {
    if (append) setLoadingMoreLeads(true);
    try {
      const response = await fetch(`/api/leads?limit=20&page=${page}`);
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível carregar os contatos."));
      }
      const payload = (await response.json()) as {
        leads?: Lead[];
        pagination?: LeadPagination;
      };
      if (
        !Array.isArray(payload.leads) ||
        !payload.pagination ||
        !Number.isInteger(payload.pagination.page) ||
        !Number.isInteger(payload.pagination.total) ||
        !Number.isInteger(payload.pagination.totalPages)
      ) {
        throw new Error("A resposta de contatos é inválida.");
      }
      setLeads((previous) => {
        if (!append) return payload.leads!;
        const known = new Set(previous.map((lead) => lead.id));
        return [...previous, ...payload.leads!.filter((lead) => !known.has(lead.id))];
      });
      setLeadPagination(payload.pagination);
      setLeadError("");
    } catch (caughtError) {
      setLeadError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar os contatos.");
    } finally {
      if (append) setLoadingMoreLeads(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void Promise.all([fetchProperties(), fetchLeads()]);
    }, 0);
    const unsubscribe = subscribeToAdminEvents((event) => {
      if (event === ADMIN_EVENTS.leadCreated) {
        setRealtimeNotice("Novo contato recebido. Consulte o e-mail e o banco de leads.");
      }
      // Pusher is only an invalidation signal; PostgreSQL remains the source of truth.
      void Promise.all([fetchProperties(true), fetchLeads()]);
    });

    return () => {
      window.clearTimeout(initialLoad);
      unsubscribe();
    };
  }, [fetchLeads, fetchProperties]);

  async function deleteProperty(id: string, version: number) {
    if (!confirm("Tem certeza que deseja excluir este imóvel?")) return;
    if (pendingIds.current.has(id)) return;

    pendingIds.current.add(id);
    setPendingAction(id, "delete");
    setError("");
    try {
      const response = await fetch(`/api/properties/${id}`, {
        method: "DELETE",
        headers: { "If-Match": String(version) },
      });
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível excluir o imóvel."));
      }
      setProperties((prev) => prev.filter((p) => p.id !== id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível excluir o imóvel.");
    } finally {
      pendingIds.current.delete(id);
      setPendingAction(id);
    }
  }

  async function toggleActive(id: string, currentActive: boolean, version: number) {
    if (pendingIds.current.has(id)) return;

    const nextActive = !currentActive;
    pendingIds.current.add(id);
    setPendingAction(id, "toggle");
    setError("");
    setProperties((previous) =>
      previous.map((property) =>
        property.id === id ? { ...property, active: nextActive } : property
      )
    );

    try {
      const response = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive, version }),
      });
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível atualizar o status."));
      }
      const updated = (await response.json()) as { version?: number };
      if (!Number.isInteger(updated.version)) {
        throw new Error("A resposta de atualização é inválida.");
      }
      setProperties((previous) =>
        previous.map((property) =>
          property.id === id ? { ...property, version: updated.version! } : property
        )
      );
    } catch (caughtError) {
      setProperties((previous) =>
        previous.map((property) =>
          property.id === id ? { ...property, active: currentActive } : property
        )
      );
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o status.");
    } finally {
      pendingIds.current.delete(id);
      setPendingAction(id);
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
      {realtimeNotice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
          <span>{realtimeNotice}</span>
          <button type="button" onClick={() => setRealtimeNotice("")} className="font-semibold">Fechar</button>
        </div>
      )}
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

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void fetchProperties()}
            className="self-start font-semibold underline underline-offset-4 sm:self-auto"
          >
            Tentar novamente
          </button>
        </div>
      )}

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

      <section
        className="rounded-xl p-5"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>Contatos recentes</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {leads.length} de {leadPagination.total} exibidos
          </span>
        </div>
        {leadError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{leadError}</p>
        ) : leads.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhum contato recebido.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {leads.map((lead) => (
              <article key={lead.id} className="rounded-lg p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{lead.name}</h3>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{lead.propertyTitle}</p>
                  </div>
                  <time className="shrink-0 text-xs" dateTime={lead.createdAt} style={{ color: "var(--text-muted)" }}>
                    {new Date(lead.createdAt).toLocaleString("pt-BR")}
                  </time>
                </div>
                <a href={`mailto:${lead.email}`} className="mt-2 block break-all text-xs font-medium text-blue-700 dark:text-blue-300">{lead.email}</a>
                {lead.phone && <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{lead.phone}</p>}
                <p className="mt-2 whitespace-pre-wrap break-words text-sm" style={{ color: "var(--text-secondary)" }}>{lead.message}</p>
                <p className="mt-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {notificationStatusLabels[lead.notificationStatus] ?? "Status do e-mail indisponível"}
                </p>
              </article>
            ))}
            {leadPagination.page < leadPagination.totalPages && (
              <button
                type="button"
                disabled={loadingMoreLeads}
                onClick={() => void fetchLeads(leadPagination.page + 1, true)}
                className="rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-60 lg:col-span-2"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                {loadingMoreLeads ? "Carregando..." : "Carregar contatos anteriores"}
              </button>
            )}
          </div>
        )}
      </section>

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
                  {getMainImageUrl(property) ? (
                    <Image
                      src={getMainImageUrl(property)!}
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
                    type="button"
                    onClick={() => toggleActive(property.id, property.active, property.version)}
                    disabled={Boolean(pendingActions[property.id])}
                    className={`btn-action ${property.active ? "btn-action-warning" : "btn-action-success"}`}
                    aria-label={`${property.active ? "Desativar" : "Ativar"} ${property.title}`}
                    aria-busy={pendingActions[property.id] === "toggle"}
                  >
                    {pendingActions[property.id] === "toggle" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="hidden sm:inline">Salvando</span>
                      </>
                    ) : property.active ? (
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
                    aria-label={`Editar ${property.title}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteProperty(property.id, property.version)}
                    disabled={Boolean(pendingActions[property.id])}
                    className="btn-action btn-action-danger"
                    aria-label={`Excluir ${property.title}`}
                    aria-busy={pendingActions[property.id] === "delete"}
                  >
                    {pendingActions[property.id] === "delete" ? (
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
