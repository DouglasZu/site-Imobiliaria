import type { NextRequest } from "next/server";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
} as const;

export type ReadJsonBodyResult =
  | { success: true; data: unknown }
  | { success: false; response: Response };

export function jsonNoStore(
  body: unknown,
  init: Omit<ResponseInit, "headers"> & { headers?: HeadersInit } = {}
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", JSON_CONTENT_TYPE);
  headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  headers.set("Pragma", NO_STORE_HEADERS.Pragma);
  headers.set("Expires", NO_STORE_HEADERS.Expires);

  return Response.json(body, { ...init, headers });
}

function errorResponse(status: 400 | 403 | 413 | 415): Response {
  const messages = {
    400: "Requisição inválida",
    403: "Requisição não permitida",
    413: "Requisição muito grande",
    415: "Tipo de conteúdo não suportado",
  } as const;

  return jsonNoStore({ error: messages[status] }, { status });
}

/** Require an explicit, syntactically valid Origin matching this request. */
export function validateSameOriginRequest(request: NextRequest): Response | null {
  const originHeader = request.headers.get("origin");
  if (!originHeader || originHeader === "null") {
    return errorResponse(403);
  }

  try {
    const parsedOrigin = new URL(originHeader);
    if (
      parsedOrigin.origin !== originHeader ||
      parsedOrigin.origin !== request.nextUrl.origin
    ) {
      return errorResponse(403);
    }
  } catch {
    return errorResponse(403);
  }

  return null;
}

function validateJsonContentType(request: NextRequest): Response | null {
  const contentType = request.headers.get("content-type");
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();

  return mediaType === "application/json" ? null : errorResponse(415);
}

function validateDeclaredLength(
  request: NextRequest,
  maxBytes: number
): Response | null {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) return null;

  const normalized = contentLength.trim();
  if (!/^\d+$/.test(normalized)) return errorResponse(400);

  try {
    if (BigInt(normalized) > BigInt(maxBytes)) return errorResponse(413);
  } catch {
    return errorResponse(400);
  }

  return null;
}

async function readBoundedBody(
  request: NextRequest,
  maxBytes: number
): Promise<Uint8Array | Response> {
  if (!request.body) return errorResponse(400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size decision is already known; cancellation errors are irrelevant.
        }
        return errorResponse(413);
      }

      chunks.push(value);
    }
  } catch {
    return errorResponse(400);
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}

/**
 * Validate request metadata, enforce both declared and actual byte limits, and
 * parse JSON without exposing parser details to clients.
 */
export async function readJsonBody(
  request: NextRequest,
  maxBytes: number
): Promise<ReadJsonBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }

  const originError = validateSameOriginRequest(request);
  if (originError) return { success: false, response: originError };

  const contentTypeError = validateJsonContentType(request);
  if (contentTypeError) {
    return { success: false, response: contentTypeError };
  }

  const lengthError = validateDeclaredLength(request, maxBytes);
  if (lengthError) return { success: false, response: lengthError };

  const body = await readBoundedBody(request, maxBytes);
  if (body instanceof Response) return { success: false, response: body };

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return { success: true, data: JSON.parse(text) as unknown };
  } catch {
    return { success: false, response: errorResponse(400) };
  }
}
