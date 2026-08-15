import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { PropertyWhereInput } from "@/types";
import type { PropertyType } from "@prisma/client";
import { canonicalizePropertyImages } from "@/lib/serialization";

export async function findProperties(where: PropertyWhereInput, skip?: number, take?: number) {
  const properties = await prisma.property.findMany({
    where: { ...where, active: true },
    include: {
      images: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { images: true } },
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    skip,
    take,
  });
  return properties.map(canonicalizePropertyImages);
}

export async function countProperties(where: PropertyWhereInput) {
  return prisma.property.count({ where: { ...where, active: true } });
}

export const findPropertyById = cache(async (id: string) => {
  const property = await prisma.property.findFirst({
    where: { id, active: true },
    include: { images: { orderBy: { order: "asc" } } },
  });
  return property ? canonicalizePropertyImages(property) : null;
});

export async function findAdminPropertyById(id: string) {
  await requireAdmin();

  const property = await prisma.property.findUnique({
    where: { id },
    // The edit form submits a full replacement. It must receive every image,
    // otherwise saving an unrelated field would silently delete the rest.
    include: { images: { orderBy: { order: "asc" } } },
  });
  return property ? canonicalizePropertyImages(property) : null;
}

export async function findRelatedProperties(property: { id: string; type: PropertyType; city: string }) {
  const properties = await prisma.property.findMany({
    where: {
      active: true,
      id: { not: property.id },
      OR: [{ type: property.type }, { city: property.city }],
    },
    include: {
      images: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { images: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  return properties.map(canonicalizePropertyImages);
}

export async function getDistinctCities() {
  const properties = await prisma.property.groupBy({
    by: ["city"],
    where: { active: true },
    orderBy: { city: "asc" },
  });
  return properties.map((p) => p.city);
}

export async function findActivePropertiesForSitemap() {
  return prisma.property.findMany({
    where: { active: true },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}
