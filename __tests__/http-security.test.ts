import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  jsonNoStore,
  readJsonBody,
  validateSameOriginRequest,
} from "@/lib/http-security";

const URL = "https://example.test/api/auth/login";
const ORIGIN = "https://example.test";

function jsonRequest(
  body: BodyInit | null,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(URL, {
    method: "POST",
    body,
    headers: {
      origin: ORIGIN,
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

describe("HTTP security helpers", () => {
  it("aceita e interpreta JSON same-origin dentro do limite", async () => {
    const result = await readJsonBody(jsonRequest('{"ok":true}'), 64);

    expect(result).toEqual({ success: true, data: { ok: true } });
  });

  it("rejeita Origin ausente, inválido ou cross-origin", () => {
    const missing = new NextRequest(URL, { method: "POST" });
    const malformed = jsonRequest("{}", { origin: "not-an-origin" });
    const crossOrigin = jsonRequest("{}", { origin: "https://attacker.test" });

    expect(validateSameOriginRequest(missing)?.status).toBe(403);
    expect(validateSameOriginRequest(malformed)?.status).toBe(403);
    expect(validateSameOriginRequest(crossOrigin)?.status).toBe(403);
  });

  it("rejeita media type que não seja JSON", async () => {
    const result = await readJsonBody(
      jsonRequest("email=x", { "content-type": "text/plain" }),
      64
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.response.status).toBe(415);
  });

  it("rejeita Content-Length declarado acima do limite", async () => {
    const result = await readJsonBody(
      jsonRequest("{}", { "content-length": "100" }),
      8
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.response.status).toBe(413);
  });

  it("mede os bytes reais mesmo sem confiar em Content-Length", async () => {
    const result = await readJsonBody(jsonRequest('{"long":"value"}'), 8);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.response.status).toBe(413);
  });

  it("normaliza JSON malformado para 400", async () => {
    const result = await readJsonBody(jsonRequest("{"), 64);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      expect(result.response.headers.get("cache-control")).toContain("no-store");
    }
  });

  it("emite respostas JSON explicitamente sem cache", async () => {
    const response = jsonNoStore({ ok: true }, { status: 202 });

    expect(response.status).toBe(202);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8"
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
