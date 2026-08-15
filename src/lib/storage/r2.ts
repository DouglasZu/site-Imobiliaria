import "server-only";

import { Buffer } from "node:buffer";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Env } from "@/lib/env";
import {
  isManagedStorageKey,
  PROPERTY_IMAGE_MAX_BYTES,
  type PropertyImageContentType,
} from "@/lib/image-policy";

const PRESIGNED_UPLOAD_TTL_SECONDS = 5 * 60;
const R2_CONNECTION_TIMEOUT_MS = 2_000;
const R2_REQUEST_TIMEOUT_MS = 8_000;
const R2_SOCKET_TIMEOUT_MS = 5_000;
const R2_MAX_ATTEMPTS = 2;
const MAX_IMAGE_DIMENSION = 10_000;
const MAX_IMAGE_PIXELS = 25_000_000;

function r2AbortSignal() {
  // Bound the whole SDK operation, including retries, rather than relying only
  // on the per-attempt request handler timeout.
  return AbortSignal.timeout(R2_REQUEST_TIMEOUT_MS);
}

const sharpFormatByContentType: Record<
  PropertyImageContentType,
  "jpeg" | "png" | "webp"
> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

let client: S3Client | null = null;
let clientAccountId: string | null = null;

function getClient() {
  const config = getR2Env();
  if (!config) throw new Error("Cloudflare R2 não configurado");

  if (!client || clientAccountId !== config.R2_ACCOUNT_ID) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      maxAttempts: R2_MAX_ATTEMPTS,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      requestHandler: {
        connectionTimeout: R2_CONNECTION_TIMEOUT_MS,
        requestTimeout: R2_REQUEST_TIMEOUT_MS,
        socketTimeout: R2_SOCKET_TIMEOUT_MS,
        throwOnRequestTimeout: true,
      },
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    });
    clientAccountId = config.R2_ACCOUNT_ID;
  }

  return { client, config };
}

export function getR2PublicUrl(storageKey: string): string {
  if (!isManagedStorageKey(storageKey)) throw new Error("Chave R2 inválida");
  const config = getR2Env();
  if (!config) throw new Error("Cloudflare R2 não configurado");
  const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
  return `${config.R2_PUBLIC_URL}/${encodedKey}`;
}

export function isStorageKeyForProperty(storageKey: string, propertyId: string) {
  return (
    isManagedStorageKey(storageKey) &&
    storageKey.startsWith(`properties/${propertyId}/`)
  );
}

export async function createR2PresignedPut(input: {
  storageKey: string;
  propertyId: string;
  uploadId: string;
  contentType: PropertyImageContentType;
  byteSize: number;
}) {
  if (!isStorageKeyForProperty(input.storageKey, input.propertyId)) {
    throw new Error("Chave R2 incompatível com o imóvel");
  }

  const { client: s3, config } = getClient();
  const metadata = {
    "upload-id": input.uploadId,
    "property-id": input.propertyId,
  };
  const command = new PutObjectCommand({
    Bucket: config.R2_BUCKET_NAME,
    Key: input.storageKey,
    ContentType: input.contentType,
    ContentLength: input.byteSize,
    IfNoneMatch: "*",
    Metadata: metadata,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS,
    signableHeaders: new Set(["content-length", "content-type", "if-none-match"]),
    unhoistableHeaders: new Set([
      "x-amz-meta-upload-id",
      "x-amz-meta-property-id",
    ]),
  });

  return {
    uploadUrl,
    headers: {
      "Content-Type": input.contentType,
      "If-None-Match": "*",
      "x-amz-meta-upload-id": input.uploadId,
      "x-amz-meta-property-id": input.propertyId,
    },
    expiresAt: new Date(Date.now() + PRESIGNED_UPLOAD_TTL_SECONDS * 1_000),
  };
}

export class InvalidR2ImageError extends Error {
  constructor() {
    super("O arquivo enviado não é uma imagem válida");
    this.name = "InvalidR2ImageError";
  }
}

export async function verifyR2Image(input: {
  storageKey: string;
  propertyId: string;
  uploadId: string;
  contentType: PropertyImageContentType;
  byteSize: number;
}) {
  if (
    !isStorageKeyForProperty(input.storageKey, input.propertyId) ||
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > PROPERTY_IMAGE_MAX_BYTES
  ) {
    throw new InvalidR2ImageError();
  }

  const { client: s3, config } = getClient();
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: config.R2_BUCKET_NAME, Key: input.storageKey }),
    { abortSignal: r2AbortSignal() }
  );

  if (
    head.ContentLength !== input.byteSize ||
    head.ContentType !== input.contentType ||
    head.Metadata?.["upload-id"] !== input.uploadId ||
    head.Metadata?.["property-id"] !== input.propertyId ||
    !head.ETag ||
    head.ContentEncoding !== undefined ||
    head.ContentDisposition !== undefined ||
    head.WebsiteRedirectLocation !== undefined
  ) {
    throw new InvalidR2ImageError();
  }

  const object = await s3.send(
    new GetObjectCommand({
      Bucket: config.R2_BUCKET_NAME,
      Key: input.storageKey,
      IfMatch: head.ETag,
    }),
    { abortSignal: r2AbortSignal() }
  );

  if (
    object.ContentLength !== input.byteSize ||
    object.ContentType !== input.contentType ||
    object.Metadata?.["upload-id"] !== input.uploadId ||
    object.Metadata?.["property-id"] !== input.propertyId ||
    object.ETag !== head.ETag ||
    object.ContentEncoding !== undefined ||
    object.ContentDisposition !== undefined ||
    object.WebsiteRedirectLocation !== undefined
  ) {
    throw new InvalidR2ImageError();
  }

  const bytes = await readBodyBounded(object.Body, input.byteSize);
  await validateDecodedImage(bytes, input.contentType);
}

async function readBodyBounded(body: unknown, expectedBytes: number): Promise<Buffer> {
  if (!isAsyncIterable(body)) throw new InvalidR2ImageError();

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of body) {
    if (!(chunk instanceof Uint8Array)) {
      destroyBody(body);
      throw new InvalidR2ImageError();
    }

    totalBytes += chunk.byteLength;
    if (totalBytes > expectedBytes) {
      destroyBody(body);
      throw new InvalidR2ImageError();
    }

    chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
  }

  if (totalBytes !== expectedBytes) throw new InvalidR2ImageError();
  return Buffer.concat(chunks, totalBytes);
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof value[Symbol.asyncIterator] === "function"
  );
}

function destroyBody(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "destroy" in body &&
    typeof body.destroy === "function"
  ) {
    try {
      body.destroy();
    } catch {
      // The validation decision is already final; stream teardown is best effort.
    }
  }
}

async function validateDecodedImage(
  bytes: Buffer,
  contentType: PropertyImageContentType
) {
  if (
    !hasExpectedMagicBytes(bytes, contentType) ||
    !hasExpectedFileEnvelope(bytes, contentType)
  ) {
    throw new InvalidR2ImageError();
  }

  const { default: sharp } = await import("sharp");

  try {
    const image = sharp(bytes, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    const width = metadata.width;
    const height = metadata.height;

    if (
      metadata.format !== sharpFormatByContentType[contentType] ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      !width ||
      !height ||
      width > MAX_IMAGE_DIMENSION ||
      height > MAX_IMAGE_DIMENSION ||
      width * height > MAX_IMAGE_PIXELS ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new InvalidR2ImageError();
    }

    // metadata() alone can accept truncated/corrupt payloads. Materializing raw
    // pixels forces libvips to decode the complete, bounded single-frame image.
    await image.raw().toBuffer();
  } catch (error) {
    if (error instanceof InvalidR2ImageError) throw error;
    throw new InvalidR2ImageError();
  }
}

function hasExpectedFileEnvelope(
  bytes: Uint8Array,
  contentType: PropertyImageContentType
): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 4 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  }

  if (contentType === "image/png") {
    const iend = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
    return (
      bytes.length >= 20 &&
      iend.every((value, index) => bytes[bytes.length - iend.length + index] === value)
    );
  }

  if (bytes.length < 12) return false;
  const declaredSize =
    (bytes[4] |
      (bytes[5] << 8) |
      (bytes[6] << 16) |
      (bytes[7] << 24)) >>>
    0;
  return declaredSize + 8 === bytes.length;
}

export function hasExpectedMagicBytes(
  bytes: Uint8Array,
  contentType: PropertyImageContentType
): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

export async function deleteR2Object(storageKey: string) {
  if (!isManagedStorageKey(storageKey)) throw new Error("Chave R2 inválida");
  const { client: s3, config } = getClient();
  await s3.send(
    new DeleteObjectCommand({ Bucket: config.R2_BUCKET_NAME, Key: storageKey }),
    { abortSignal: r2AbortSignal() }
  );
}
