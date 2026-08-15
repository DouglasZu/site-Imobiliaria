"use client";

import { useState } from "react";
import { AlertCircle, Check, Share2 } from "lucide-react";

type ShareStatus = "idle" | "copied" | "error";

export default function ShareButton() {
  const [status, setStatus] = useState<ShareStatus>("idle");

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2_000);
    } catch {
      setStatus("error");
    }
  }

  async function handleShare() {
    setStatus("idle");

    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url: window.location.href });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    await copyToClipboard();
  }

  const label =
    status === "copied"
      ? "Link copiado!"
      : status === "error"
        ? "Não foi possível copiar"
        : "Compartilhar";

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-medium transition-all"
      style={{
        background: "var(--bg-secondary)",
        color:
          status === "copied"
            ? "var(--color-success, #047857)"
            : status === "error"
              ? "#b91c1c"
              : "var(--text-secondary)",
        border: "1px solid var(--border)",
      }}
      aria-live="polite"
    >
      {status === "copied" ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : status === "error" ? (
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Share2 className="h-4 w-4" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}
