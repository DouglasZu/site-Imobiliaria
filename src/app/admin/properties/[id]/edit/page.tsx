import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  const property = await prisma.property.findUnique({
    where: { id },
    include: { images: { orderBy: { order: "asc" } } },
  });

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
      <PropertyForm initialData={property} />
    </div>
  );
}
