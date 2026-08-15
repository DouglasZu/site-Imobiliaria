"use client";

import { useRef, useState } from "react";
import { Loader2, Mail } from "lucide-react";

export default function InterestForm({ propertyId }: { propertyId: string }) {
  const requestId = useRef(crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSending(true);
    setFeedback(null);
    const form = new FormData(formElement);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          propertyId,
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          message: form.get("message"),
          website: form.get("website"),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok) throw new Error(payload?.error || "Não foi possível enviar.");
      formElement.reset();
      requestId.current = crypto.randomUUID();
      setFeedback({ type: "success", text: payload?.message || "Contato recebido." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível enviar.",
      });
    } finally {
      setSending(false);
    }
  }

  const inputClass = "w-full rounded-lg px-3 py-2.5 text-sm";
  const inputStyle = { background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <section
      className="rounded-xl p-6 sm:p-8"
      style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-5 flex items-center gap-2">
        <Mail className="h-5 w-5" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
        <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>Tenho interesse</h2>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" aria-busy={sending}>
        <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Nome
          <input name="name" required minLength={2} maxLength={100} autoComplete="name" className={`${inputClass} mt-1.5`} style={inputStyle} />
        </label>
        <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          E-mail
          <input name="email" type="email" required maxLength={254} autoComplete="email" className={`${inputClass} mt-1.5`} style={inputStyle} />
        </label>
        <label className="text-sm font-medium sm:col-span-2" style={{ color: "var(--text-secondary)" }}>
          Telefone (opcional)
          <input name="phone" type="tel" maxLength={25} autoComplete="tel" className={`${inputClass} mt-1.5`} style={inputStyle} />
        </label>
        <label className="text-sm font-medium sm:col-span-2" style={{ color: "var(--text-secondary)" }}>
          Mensagem
          <textarea name="message" required minLength={10} maxLength={2000} rows={4} defaultValue="Olá, gostaria de receber mais informações sobre este imóvel." className={`${inputClass} mt-1.5 resize-y`} style={inputStyle} />
        </label>
        <label className="absolute -left-[10000px]" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        {feedback && (
          <p role={feedback.type === "error" ? "alert" : "status"} className={`text-sm sm:col-span-2 ${feedback.type === "error" ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
            {feedback.text}
          </p>
        )}
        <div className="sm:col-span-2">
          <button type="submit" disabled={sending} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60">
            {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {sending ? "Enviando..." : "Enviar interesse"}
          </button>
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Seus dados serão usados somente para responder a este contato.
          </p>
        </div>
      </form>
    </section>
  );
}
