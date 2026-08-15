import { describe, expect, it } from "vitest";
import {
  parsePropertyQuery,
  propertySchema,
  propertyStatusSchema,
} from "@/lib/schemas/property";

const validProperty = {
  title: "Apartamento no Centro",
  description: "Apartamento bem localizado, iluminado e pronto para morar.",
  price: "450000.50",
  city: "São Paulo",
  neighborhood: "Centro",
  address: "Rua das Flores, 123",
  type: "APARTMENT",
  purpose: "SALE",
  bedrooms: "2",
  bathrooms: "1",
  area: "70.5",
  whatsappPhone: "5511999999999",
  featured: false,
  active: true,
  images: [{ url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa" }],
};

describe("propertySchema", () => {
  it("normaliza números e campos opcionais de uma requisição válida", () => {
    const parsed = propertySchema.parse({
      ...validProperty,
      address: "",
      bedrooms: "",
    });

    expect(parsed.price).toBe(450000.5);
    expect(parsed.address).toBeNull();
    expect(parsed.bedrooms).toBeNull();
  });

  it.each([
    "http://images.unsplash.com/photo.jpg",
    "https://images.unsplash.com.evil.example/photo.jpg",
    "https://example.com/photo.jpg",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg onload=alert(1) />",
    "file:///etc/passwd",
  ])("rejeita origem de imagem não autorizada: %s", (url) => {
    const result = propertySchema.safeParse({
      ...validProperty,
      images: [{ url }],
    });

    expect(result.success).toBe(false);
  });

  it("limita tamanho, quantidade e valores numéricos", () => {
    expect(
      propertySchema.safeParse({ ...validProperty, title: "x".repeat(121) }).success
    ).toBe(false);
    expect(
      propertySchema.safeParse({ ...validProperty, bedrooms: -1 }).success
    ).toBe(false);
    expect(
      propertySchema.safeParse({
        ...validProperty,
        images: Array.from({ length: 13 }, () => validProperty.images[0]),
      }).success
    ).toBe(false);
  });

  it("rejeita campos inesperados para evitar mass assignment", () => {
    const result = propertySchema.safeParse({
      ...validProperty,
      role: "admin",
    });

    expect(result.success).toBe(false);
    expect(propertyStatusSchema.safeParse({ active: false, featured: true }).success).toBe(
      false
    );
  });
});

describe("parsePropertyQuery", () => {
  it("aplica defaults e limites seguros", () => {
    const result = parsePropertyQuery(new URLSearchParams());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ page: 1, limit: 12 });
    }
  });

  it.each([
    "page=0",
    "page=abc",
    "limit=51",
    "minPrice=-1",
    "minPrice=200&maxPrice=100",
    `search=${"x".repeat(201)}`,
    "unknown=value",
  ])("rejeita query inválida: %s", (query) => {
    expect(parsePropertyQuery(new URLSearchParams(query)).success).toBe(false);
  });

  it("rejeita parâmetros duplicados em vez de aceitar arrays silenciosamente", () => {
    const params = new URLSearchParams();
    params.append("city", "São Paulo");
    params.append("city", "Campinas");

    expect(parsePropertyQuery(params).success).toBe(false);
  });
});
