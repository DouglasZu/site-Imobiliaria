import { randomUUID } from "node:crypto";
import PropertyForm from "@/components/admin/PropertyForm";
import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Novo Imóvel",
};

export default async function NewPropertyPage() {
  await requireAdmin();
  const draftPropertyId = randomUUID();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Cadastrar Novo Imóvel
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Preencha as informações do imóvel
        </p>
      </div>
      <PropertyForm propertyId={draftPropertyId} />
    </div>
  );
}
