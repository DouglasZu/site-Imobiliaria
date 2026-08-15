"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// Component to update map view when coordinates change
const MapUpdater = dynamic(
  () => import("./MapUpdater"),
  { ssr: false }
);

// Known city coordinates as fallback
const CITY_COORDINATES: Record<string, [number, number]> = {
  "são paulo": [-23.5505, -46.6333],
  "rio de janeiro": [-22.9068, -43.1729],
  "belo horizonte": [-19.9167, -43.9345],
  "curitiba": [-25.4284, -49.2733],
  "porto alegre": [-30.0346, -51.2177],
  "brasília": [-15.7975, -47.8919],
  "salvador": [-12.9714, -38.5124],
  "recife": [-8.0476, -34.877],
  "fortaleza": [-3.7172, -38.5433],
  "campinas": [-22.9099, -47.0626],
  "santos": [-23.9608, -46.3336],
  "ribeirão preto": [-21.1704, -47.8103],
  "sorocaba": [-23.5015, -47.4526],
  "ibiúna": [-23.6566, -47.2225],
  "guarulhos": [-23.4538, -46.5333],
};

interface GeocodeResult {
  lat: number;
  lon: number;
  zoom: number;
}

const geocodeCache = new Map<string, GeocodeResult | null>();
const GEOCODE_TIMEOUT_MS = 4000;

interface PropertyMapProps {
  city: string;
  neighborhood: string;
  title: string;
  address?: string;
}

async function geocodeAddress(
  city: string,
  neighborhood: string,
  address?: string
): Promise<GeocodeResult | null> {
  // Try most specific first: full address
  const queries = [];

  if (address) {
    queries.push(`${address}, ${neighborhood}, ${city}, Brasil`);
  }
  queries.push(`${neighborhood}, ${city}, Brasil`);
  queries.push(`${city}, Brasil`);

  const cacheKey = queries.join("|").toLocaleLowerCase("pt-BR");
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) ?? null;

  for (const query of queries) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`,
        {
          headers: { "Accept-Language": "pt-BR,pt;q=0.9" },
          signal: controller.signal,
        }
      );

      if (!res.ok) continue;

      const data: unknown = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const firstResult = data[0] as { lat?: unknown; lon?: unknown };
        const lat = typeof firstResult.lat === "string" ? Number.parseFloat(firstResult.lat) : Number.NaN;
        const lon = typeof firstResult.lon === "string" ? Number.parseFloat(firstResult.lon) : Number.NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const zoom = address && queries.indexOf(query) === 0 ? 16 : 14;
        const result = { lat, lon, zoom };
        geocodeCache.set(cacheKey, result);
        return result;
      }
    } catch {
      continue;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  geocodeCache.set(cacheKey, null);
  return null;
}

export default function PropertyMap({
  city,
  neighborhood,
  title,
  address,
}: PropertyMapProps) {
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [zoom, setZoom] = useState(14);
  const [loading, setLoading] = useState(true);
  const [approximate, setApproximate] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function findCoordinates() {
      setLoading(true);

      // Try geocoding via Nominatim
      const result = await geocodeAddress(city, neighborhood, address);
      if (cancelled) return;

      if (result) {
        setCoordinates([result.lat, result.lon]);
        setZoom(result.zoom);
        setApproximate(result.zoom < 16);
      } else {
        // Fallback to known city coordinates
        const cityKey = city.toLowerCase().trim();
        const fallback = CITY_COORDINATES[cityKey];
        if (fallback) {
          setCoordinates(fallback);
          setZoom(13);
          setApproximate(true);
        } else {
          setCoordinates(null);
        }
      }

      setLoading(false);
    }

    findCoordinates();
    return () => {
      cancelled = true;
    };
  }, [city, neighborhood, address]);

  if (loading) {
    return (
      <div
        className="h-[300px] sm:h-[400px] rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          border: "1px solid var(--border)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#0F172A" }} />
          <span
            className="text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Carregando mapa...
          </span>
        </div>
      </div>
    );
  }

  if (!coordinates) {
    return (
      <div
        className="flex h-[300px] items-center justify-center rounded-xl px-6 text-center sm:h-[400px]"
        role="status"
        style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}
      >
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Localização indisponível. Consulte o endereço informado no anúncio.
        </span>
      </div>
    );
  }

  return (
    <div
      className="h-[300px] sm:h-[400px] rounded-xl overflow-hidden"
      role="region"
      aria-label={`Mapa de ${title}`}
      style={{ border: "1px solid var(--border)" }}
    >
      <MapContainer
        center={coordinates}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={coordinates}>
          <Popup>
            <strong>{title}</strong>
            <br />
            {neighborhood}, {city}
            {approximate && (
              <>
                <br />
                <span>Localização aproximada</span>
              </>
            )}
          </Popup>
        </Marker>
        <MapUpdater center={coordinates} zoom={zoom} />
      </MapContainer>
    </div>
  );
}
