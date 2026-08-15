import { notFound } from "next/navigation";
import { findAdminPropertyById } from "@/lib/queries/property";
import PropertyForm from "@/components/admin/PropertyForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editar Imóvel",
};

interface EditPropertyPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { id } = await params;

  const property = await findAdminPropertyById(id);

  if (!property) notFound();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Editar Imóvel
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Atualize as informações do imóvel
        </p>
      </div>
      <PropertyForm
        propertyId={property.id}
        initialData={{ ...property, price: property.price.toString() }}
      />
    </div>
  );
}
