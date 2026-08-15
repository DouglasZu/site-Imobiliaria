import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";

const mocks = vi.hoisted(() => ({ verifyToken: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  AUTH_COOKIE_NAME: "admin-token",
  verifyToken: mocks.verifyToken,
}));

import proxy, { config } from "@/proxy";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyToken.mockResolvedValue(null);
});

describe("proxy matcher", () => {
  it.each([
    ["/", true],
    ["/properties", true],
    ["/admin", true],
    ["/api/properties", false],
    ["/_next/static/chunk.js", false],
    ["/_next/image?url=x", false],
    ["/favicon.ico", false],
  ])("matches %s = %s", (url, expected) => {
    expect(
      doesProxyMatch({ config, nextConfig: {}, url })
    ).toBe(expected);
  });
});

describe("proxy behavior", () => {
  it("allows only the exact login path without a session", async () => {
    const login = await proxy(
      new NextRequest("https://example.test/admin/login")
    );
    const lookalike = await proxy(
      new NextRequest("https://example.test/admin/login-history")
    );

    expect(login.status).toBe(200);
    expect(lookalike.status).toBe(307);
    expect(lookalike.headers.get("location")).toBe(
      "https://example.test/admin/login"
    );
  });

  it("redirects an invalid session and clears its cookie", async () => {
    const request = new NextRequest("https://example.test/admin", {
      headers: { cookie: "admin-token=invalid" },
    });

    const response = await proxy(request);

    expect(mocks.verifyToken).toHaveBeenCalledWith("invalid");
    expect(response.status).toBe(307);
    expect(response.headers.get("set-cookie")).toContain("admin-token=");
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("uses a fresh nonce and never allows arbitrary inline scripts", async () => {
    const first = await proxy(new NextRequest("https://example.test/"));
    const second = await proxy(new NextRequest("https://example.test/"));
    const firstPolicy = first.headers.get("content-security-policy") ?? "";
    const secondPolicy = second.headers.get("content-security-policy") ?? "";
    const firstNonce = firstPolicy.match(/'nonce-([^']+)'/)?.[1];
    const secondNonce = secondPolicy.match(/'nonce-([^']+)'/)?.[1];

    expect(firstNonce).toBeTruthy();
    expect(secondNonce).toBeTruthy();
    expect(firstNonce).not.toBe(secondNonce);
    expect(firstPolicy.match(/script-src[^;]+/)?.[0]).not.toContain(
      "'unsafe-inline'"
    );
    expect(firstPolicy).toContain("frame-ancestors 'none'");
  });
});
