import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  secret: "unit-test-secret-with-more-than-32-characters",
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  findAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "file:./test.db",
    JWT_SECRET: mocks.secret,
    WHATSAPP_PHONE: "5511999999999",
    NODE_ENV: "production",
  },
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
    delete: mocks.cookieDelete,
  })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { admin: { findUnique: mocks.findAdmin } },
}));

import {
  AUTH_COOKIE_NAME,
  getCurrentAdmin,
  setAuthCookie,
  signToken,
  verifyToken,
} from "@/lib/auth";

const encodedSecret = new TextEncoder().encode(mocks.secret);

function customToken(options: { audience?: string; expires?: boolean } = {}) {
  let token = new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("admin-id")
    .setIssuer("lar-imoveis")
    .setAudience(options.audience ?? "lar-imoveis-admin")
    .setIssuedAt();

  if (options.expires !== false) token = token.setExpirationTime("1h");
  return token.sign(encodedSecret);
}

describe("sessões administrativas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assina e verifica apenas tokens com os claims obrigatórios", async () => {
    const valid = await signToken("admin-id");
    const claims = await verifyToken(valid);
    const withoutExpiration = await customToken({ expires: false });
    const wrongAudience = await customToken({ audience: "other-audience" });

    expect(claims?.sub).toBe("admin-id");
    expect(claims?.iat).toEqual(expect.any(Number));
    expect(claims?.exp).toEqual(expect.any(Number));
    expect(await verifyToken(withoutExpiration)).toBeNull();
    expect(await verifyToken(wrongAudience)).toBeNull();
  });

  it("usa cookie __Host- com flags rígidas em produção", async () => {
    await setAuthCookie("signed-token");

    expect(AUTH_COOKIE_NAME).toBe("__Host-admin-session");
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "__Host-admin-session",
      "signed-token",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        priority: "high",
      })
    );
  });

  it("revoga na prática a sessão quando o admin deixa de existir", async () => {
    const token = await signToken("removed-admin");
    mocks.cookieGet.mockReturnValue({ value: token });
    mocks.findAdmin.mockResolvedValue(null);

    expect(await getCurrentAdmin()).toBeNull();
    expect(mocks.findAdmin).toHaveBeenCalledWith({
      where: { id: "removed-admin" },
      select: { id: true, email: true },
    });
  });
});
