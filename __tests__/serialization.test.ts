import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/r2", () => ({
  getR2PublicUrl: (storageKey: string) => `https://current-media.example/${storageKey}`,
}));

import { serializeProperty } from "@/lib/serialization";

describe("property serialization", () => {
  it("deriva URL pública atual de storageKey em vez da URL persistida", () => {
    const result = serializeProperty({
      id: "property-1",
      price: { toString: () => "100.00" },
      images: [
        {
          id: "image-1",
          storageKey:
            "properties/property-1/00000000-0000-0000-0000-000000000000.png",
          url: "https://old-media.example/stale.png",
        },
      ],
    });

    expect(result.price).toBe("100.00");
    expect(result.images[0].url).toBe(
      "https://current-media.example/properties/property-1/00000000-0000-0000-0000-000000000000.png"
    );
  });

  it("preserva URL legada quando não existe storageKey", () => {
    const url = "https://images.unsplash.com/photo-1";
    const result = serializeProperty({ price: 10, images: [{ url, storageKey: null }] });
    expect(result.images[0].url).toBe(url);
  });
});
