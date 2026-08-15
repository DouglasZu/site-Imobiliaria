"use client";

import { AlertTriangle } from "lucide-react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <AlertTriangle className="mb-5 h-12 w-12 text-amber-500" aria-hidden="true" />
      <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
        Algo deu errado
      </h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Não foi possível carregar esta página. Você pode tentar novamente agora.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg px-5 py-3 text-sm font-semibold text-white"
        style={{ background: "#0F172A" }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
