"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

function readFavorites(): string[] {
  try {
    const storedValue = localStorage.getItem("favorites");
    if (!storedValue) return [];
    const parsedValue: unknown = JSON.parse(storedValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export default function FavoriteButton({ propertyId }: { propertyId: string }) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    // Browser storage is intentionally read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFavorite(readFavorites().includes(propertyId));
  }, [propertyId]);

  function toggleFavorite() {
    const favorites = readFavorites();
    const updated = isFavorite
      ? favorites.filter((id) => id !== propertyId)
      : Array.from(new Set([...favorites, propertyId]));

    try {
      localStorage.setItem("favorites", JSON.stringify(updated));
    } catch {
      // The interaction remains usable in memory when storage is unavailable.
    }

    setIsFavorite(!isFavorite);
  }

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      className="absolute right-3 top-3 rounded-full bg-white/90 p-2 backdrop-blur-sm transition-all hover:scale-110 dark:bg-gray-900/70"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
      aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={isFavorite}
    >
      <Heart
        aria-hidden="true"
        className={`h-4 w-4 transition-colors ${
          isFavorite
            ? "fill-red-500 text-red-500"
            : "text-gray-500 dark:text-gray-300"
        }`}
      />
    </button>
  );
}
