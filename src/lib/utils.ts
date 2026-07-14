/**
 * Format a number as Brazilian Real (BRL)
 */
export function formatPrice(price: number, purpose?: string): string {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
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
export function getWhatsAppLink(propertyTitle: string, phone: string = "5511999999999"): string {
  const message = encodeURIComponent(
    `Olá! Tenho interesse no imóvel: ${propertyTitle}. Poderia me enviar mais informações?`
  );
  return `https://wa.me/${phone}?text=${message}`;
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
