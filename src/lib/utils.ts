/**
 * Format a number as Brazilian Real (BRL)
 * Accepts number, string, or Prisma Decimal
 */
export function formatPrice(price: number | string, purpose?: string): string {
  const numericPrice = Number(price);
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericPrice);
  return purpose === "RENT" ? `${formatted}/mês` : formatted;
}

/**
 * Merge CSS class names, filtering out falsy values
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Property type labels in Portuguese
 */
export const propertyTypeLabels: Record<string, string> = {
  HOUSE: "Casa",
  APARTMENT: "Apartamento",
  LAND: "Terreno",
  COMMERCIAL: "Comercial",
  FARM: "Chácara / Sítio",
};

/**
 * All property types
 */
export const propertyTypes = ["HOUSE", "APARTMENT", "LAND", "COMMERCIAL", "FARM"] as const;

/**
 * Property purpose labels in Portuguese
 */
export const propertyPurposeLabels: Record<string, string> = {
  SALE: "Comprar",
  RENT: "Alugar",
};

/**
 * All property purposes
 */
export const propertyPurposes = ["SALE", "RENT"] as const;

/**
 * Generate WhatsApp link with pre-filled message
 */
export function getWhatsAppLink(propertyTitle: string, phone: string): string {
  const normalizedPhone = phone.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(normalizedPhone)) {
    throw new Error("O telefone do WhatsApp deve incluir DDI e DDD.");
  }

  const message = encodeURIComponent(
    `Olá! Tenho interesse no imóvel: ${propertyTitle}. Poderia me enviar mais informações?`
  );
  return `https://wa.me/${normalizedPhone}?text=${message}`;
}

/**
 * Format the configured WhatsApp phone for display without inventing contact data.
 */
export function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("55") && digits.length === 13) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.startsWith("55") && digits.length === 12) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  return `+${digits}`;
}

/**
 * Truncate text to a max length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

/**
 * Generate slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
