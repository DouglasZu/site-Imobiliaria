import { describe, it, expect } from "vitest";
import { formatPrice, cn, truncate, slugify, getWhatsAppLink } from "@/lib/utils";

describe("Utility functions in src/lib/utils.ts", () => {
  describe("formatPrice", () => {
    it("should format sale price as Brazilian Real", () => {
      const price = 450000;
      const formatted = formatPrice(price);
      // Remove non-breaking spaces for testing comparison
      const normalized = formatted.replace(/\s/g, " ");
      expect(normalized).toContain("R$");
      expect(normalized).toContain("450.000");
      expect(normalized).not.toContain("/mês");
    });

    it("should format rent price with /mês suffix", () => {
      const price = 2500;
      const formatted = formatPrice(price, "RENT");
      const normalized = formatted.replace(/\s/g, " ");
      expect(normalized).toContain("R$");
      expect(normalized).toContain("2.500");
      expect(normalized).toContain("/mês");
    });
  });

  describe("cn", () => {
    it("should merge css classes and filter out falsy values", () => {
      const result = cn("class1", false, "class2", null, undefined, "class3");
      expect(result).toBe("class1 class2 class3");
    });
  });

  describe("truncate", () => {
    it("should truncate text if it exceeds max length", () => {
      const text = "Este é um texto longo que precisa ser truncado.";
      const truncated = truncate(text, 10);
      expect(truncated).toBe("Este é um...");
    });

    it("should not truncate text if it is within max length", () => {
      const text = "Curto";
      const truncated = truncate(text, 10);
      expect(truncated).toBe("Curto");
    });
  });

  describe("slugify", () => {
    it("should normalize accents and generate clean slug", () => {
      const text = "Apartamento Luxuoso em São Paulo!";
      const slug = slugify(text);
      expect(slug).toBe("apartamento-luxuoso-em-sao-paulo");
    });
  });

  describe("getWhatsAppLink", () => {
    it("should generate correct WhatsApp contact link", () => {
      const title = "Apartamento Centro";
      const link = getWhatsAppLink(title, "5511999999999");
      expect(link).toContain("wa.me/5511999999999");
      expect(link).toContain("text=");
      expect(link).toContain("Apartamento%20Centro");
    });
  });
});
