import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  readJsonBody: vi.fn(),
  jsonNoStore: vi.fn((body: unknown, init: ResponseInit = {}) =>
    Response.json(body, init)
  ),
  consumeLoginRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "192.0.2.1"),
  findUnique: vi.fn(),
  comparePassword: vi.fn(),
  signToken: vi.fn(),
  setAuthCookie: vi.fn(),
}));

vi.mock("@/lib/http-security", () => ({
  readJsonBody: mocks.readJsonBody,
  jsonNoStore: mocks.jsonNoStore,
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeLoginRateLimit: mocks.consumeLoginRateLimit,
  getClientIp: mocks.getClientIp,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { admin: { findUnique: mocks.findUnique } },
}));
vi.mock("@/lib/auth", () => ({
  comparePassword: mocks.comparePassword,
  signToken: mocks.signToken,
  setAuthCookie: mocks.setAuthCookie,
}));

import { POST } from "@/app/api/auth/login/route";

const credentials = {
  email: "admin@example.test",
  password: "not-the-password",
};

function loginRequest() {
  return new NextRequest("https://example.test/api/auth/login", {
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readJsonBody.mockResolvedValue({ success: true, data: credentials });
  mocks.consumeLoginRateLimit.mockResolvedValue({
    allowed: true,
    retryAfterSeconds: 0,
    violatedScopes: [],
  });
  mocks.comparePassword.mockResolvedValue(false);
});

describe("POST /api/auth/login", () => {
  it("executa exatamente um bcrypt válido também para conta inexistente", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await POST(loginRequest());

    expect(response.status).toBe(401);
    expect(mocks.comparePassword).toHaveBeenCalledTimes(1);
    expect(mocks.comparePassword.mock.calls[0][1]).toMatch(/^\$2[aby]\$12\$/);
    await expect(response.json()).resolves.toEqual({ error: "Credenciais inválidas" });
  });

  it("usa a mesma resposta genérica para senha errada de conta existente", async () => {
    mocks.findUnique.mockResolvedValue({ id: "admin", passwordHash: "hash" });

    const response = await POST(loginRequest());

    expect(response.status).toBe(401);
    expect(mocks.comparePassword).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ error: "Credenciais inválidas" });
  });

  it("responde 429 com Retry-After antes de consultar a conta ou executar bcrypt", async () => {
    mocks.consumeLoginRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 120,
      violatedScopes: ["ip"],
    });

    const response = await POST(loginRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.comparePassword).not.toHaveBeenCalled();
  });

  it("só cria cookie depois de credenciais válidas", async () => {
    mocks.findUnique.mockResolvedValue({ id: "admin", passwordHash: "hash" });
    mocks.comparePassword.mockResolvedValue(true);
    mocks.signToken.mockResolvedValue("signed-token");

    const response = await POST(loginRequest());

    expect(response.status).toBe(200);
    expect(mocks.signToken).toHaveBeenCalledWith("admin");
    expect(mocks.setAuthCookie).toHaveBeenCalledWith("signed-token");
  });
});
