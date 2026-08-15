import { Buffer } from "node:buffer";
import { crc32 } from "node:zlib";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clientConfigs: [] as Record<string, unknown>[],
  send: vi.fn(),
}));

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
vi.mock("@aws-sdk/client-s3", () => {
  class Command {
    constructor(readonly input: Record<string, unknown>) {}
  }

  return {
    DeleteObjectCommand: class DeleteObjectCommand extends Command {},
    GetObjectCommand: class GetObjectCommand extends Command {},
    HeadObjectCommand: class HeadObjectCommand extends Command {},
    PutObjectCommand: class PutObjectCommand extends Command {},
    S3Client: class S3Client {
      constructor(config: Record<string, unknown>) {
        mocks.clientConfigs.push(config);
      }

      send(command: Command) {
        return mocks.send(command);
      }
    },
  };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));

import {
  InvalidR2ImageError,
  verifyR2Image,
} from "@/lib/storage/r2";
import type { PropertyImageContentType } from "@/lib/image-policy";

const extensionByContentType: Record<PropertyImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

beforeEach(() => {
  mocks.send.mockReset();
});

describe("R2 image verification", () => {
  it("bounds SDK attempts/timeouts and downloads the complete ETag-bound object", async () => {
    const bytes = await createImage("image/png");
    queueObject(bytes, "image/png");

    await verifyR2Image(uploadInput("image/png", bytes.length));

    expect(mocks.clientConfigs[0]).toEqual(
      expect.objectContaining({
        maxAttempts: 2,
        requestHandler: {
          connectionTimeout: 2_000,
          requestTimeout: 8_000,
          socketTimeout: 5_000,
          throwOnRequestTimeout: true,
        },
      })
    );
    expect(mocks.send.mock.calls[1]?.[0].input).toEqual({
      Bucket: "images",
      Key: uploadInput("image/png", bytes.length).storageKey,
      IfMatch: '"etag-1"',
    });
  });

  it.each([
    ["image/jpeg"],
    ["image/png"],
    ["image/webp"],
  ] as const)("fully decodes a valid %s payload", async (contentType) => {
    const bytes = await createImage(contentType);
    queueObject(bytes, contentType);

    await expect(
      verifyR2Image(uploadInput(contentType, bytes.length))
    ).resolves.toBeUndefined();
  });

  it("rejects a corrupt image even when its signature and final marker are intact", async () => {
    const bytes = await createImage("image/png");
    const idatTypeOffset = bytes.indexOf(Buffer.from("IDAT"));
    const idatLength = bytes.readUInt32BE(idatTypeOffset - 4);
    const idatCrcOffset = idatTypeOffset + 4 + idatLength;
    bytes[idatCrcOffset] ^= 0xff;
    queueObject(bytes, "image/png");

    await expect(
      verifyR2Image(uploadInput("image/png", bytes.length))
    ).rejects.toBeInstanceOf(InvalidR2ImageError);
  });

  it("rejects content whose decoded format differs from the declared MIME", async () => {
    const bytes = await createImage("image/jpeg");
    queueObject(bytes, "image/png");

    await expect(
      verifyR2Image(uploadInput("image/png", bytes.length))
    ).rejects.toBeInstanceOf(InvalidR2ImageError);
  });

  it("rejects trailing data after the image envelope", async () => {
    const image = await createImage("image/png");
    const bytes = Buffer.concat([image, Buffer.from("<script>ignored by some decoders</script>")]);
    queueObject(bytes, "image/png");

    await expect(
      verifyR2Image(uploadInput("image/png", bytes.length))
    ).rejects.toBeInstanceOf(InvalidR2ImageError);
  });

  it("rejects dimensions above the per-axis limit", async () => {
    const bytes = await createImage("image/png", 10_001, 1);
    queueObject(bytes, "image/png");

    await expect(
      verifyR2Image(uploadInput("image/png", bytes.length))
    ).rejects.toBeInstanceOf(InvalidR2ImageError);
  });

  it("rejects headers declaring more than the pixel limit", async () => {
    const bytes = await createImage("image/png");
    bytes.writeUInt32BE(5_001, 16);
    bytes.writeUInt32BE(5_000, 20);
    bytes.writeUInt32BE(crc32(bytes.subarray(12, 29)), 29);
    queueObject(bytes, "image/png");

    await expect(
      verifyR2Image(uploadInput("image/png", bytes.length))
    ).rejects.toBeInstanceOf(InvalidR2ImageError);
  });

  it("stops and rejects a body that exceeds the HEAD size", async () => {
    const bytes = await createImage("image/png");
    const body = streamBody([bytes, Buffer.from([0])]);
    queueObject(bytes, "image/png", body);

    await expect(
      verifyR2Image(uploadInput("image/png", bytes.length))
    ).rejects.toBeInstanceOf(InvalidR2ImageError);
    expect(body.destroy).toHaveBeenCalledOnce();
  });
});

function uploadInput(contentType: PropertyImageContentType, byteSize: number) {
  return {
    storageKey: `properties/property-1/00000000-0000-0000-0000-000000000000.${extensionByContentType[contentType]}`,
    propertyId: "property-1",
    uploadId: "upload-1",
    contentType,
    byteSize,
  };
}

async function createImage(
  contentType: PropertyImageContentType,
  width = 8,
  height = 6
) {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 24, g: 96, b: 160 },
    },
  });

  if (contentType === "image/jpeg") return image.jpeg().toBuffer();
  if (contentType === "image/webp") return image.webp().toBuffer();
  return image.png().toBuffer();
}

function queueObject(
  bytes: Buffer,
  contentType: PropertyImageContentType,
  body = streamBody([bytes])
) {
  const metadata = {
    ContentLength: bytes.length,
    ContentType: contentType,
    Metadata: { "upload-id": "upload-1", "property-id": "property-1" },
    ETag: '"etag-1"',
  };
  mocks.send.mockResolvedValueOnce(metadata).mockResolvedValueOnce({ ...metadata, Body: body });
}

function streamBody(chunks: readonly Uint8Array[]) {
  return {
    destroy: vi.fn(),
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}
