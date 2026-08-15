import { Property, Image, Prisma } from "@prisma/client";

export type PropertyWithImages = Property & { images: Image[] };

// DTO (Data Transfer Object) para evitar passar instâncias completas de Decimal para Client Components
export type PropertyCardDTO = Omit<PropertyWithImages, "price" | "createdAt" | "updatedAt"> & {
  price: string;
  createdAt?: string;
  updatedAt?: string;
};

// Extensão segura de onde clause do Prisma
export type PropertyWhereInput = Prisma.PropertyWhereInput;
