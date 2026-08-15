import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getR2Env: () => ({
    R2_ACCOUNT_ID: "a".repeat(32),
    R2_ACCESS_KEY_ID: "access-key-123456",
    R2_SECRET_ACCESS_KEY: "s".repeat(40),
    R2_BUCKET_NAME: "images",
    R2_PUBLIC_URL: "https://images.example.com",
  }),
}));

import {
  PROPERTY_IMAGE_MAX_BYTES,
} from "@/lib/image-policy";
import { presignUploadSchema } from "@/lib/schemas/upload";
import { createR2PresignedPut, hasExpectedMagicBytes } from "@/lib/storage/r2";

describe("upload schema", () => {
  it("assina tamanho, MIME, condição de criação e metadados sem expor segredo", async () => {
    const signed = await createR2PresignedPut({
      storageKey: "properties/property-1/00000000-0000-0000-0000-000000000000.png",
      propertyId: "property-1",
      uploadId: "upload-1",
      contentType: "image/png",
      byteSize: 100,
    });
    const url = new URL(signed.uploadUrl);
    const headers = url.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];
    expect(headers).toEqual(
      expect.arrayContaining([
        "content-length",
        "content-type",
        "if-none-match",
        "x-amz-meta-property-id",
        "x-amz-meta-upload-id",
      ])
    );
    expect(url.origin).toBe(
      `https://images.${"a".repeat(32)}.r2.cloudflarestorage.com`
    );
    expect(signed.uploadUrl).not.toContain("ssssssss");
  });

  it("aceita somente MIME e tamanho permitidos", () => {
    expect(
      presignUploadSchema.safeParse({
        propertyId: "property-1",
        contentType: "image/webp",
        size: 100,
      }).success
    ).toBe(true);
    expect(
      presignUploadSchema.safeParse({
        propertyId: "property-1",
        contentType: "image/svg+xml",
        size: 100,
      }).success
    ).toBe(false);
    expect(
      presignUploadSchema.safeParse({
        propertyId: "property-1",
        contentType: "image/png",
        size: PROPERTY_IMAGE_MAX_BYTES + 1,
      }).success
    ).toBe(false);
  });

  it("rejeita campos extras e identificadores com path traversal", () => {
    expect(
      presignUploadSchema.safeParse({
        propertyId: "../../admin",
        contentType: "image/png",
        size: 100,
        filename: "evil.png",
      }).success
    ).toBe(false);
  });
});

describe("magic bytes", () => {
  it("reconhece JPEG, PNG e WebP reais", () => {
    expect(hasExpectedMagicBytes(Uint8Array.from([0xff, 0xd8, 0xff]), "image/jpeg")).toBe(true);
    expect(
      hasExpectedMagicBytes(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png"
      )
    ).toBe(true);
    expect(
      hasExpectedMagicBytes(
        Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
        "image/webp"
      )
    ).toBe(true);
  });

  it("não confia no Content-Type quando os bytes não correspondem", () => {
    const html = new TextEncoder().encode("<html>not an image</html>");
    expect(hasExpectedMagicBytes(html, "image/png")).toBe(false);
    expect(hasExpectedMagicBytes(html, "image/jpeg")).toBe(false);
    expect(hasExpectedMagicBytes(html, "image/webp")).toBe(false);
  });
});
