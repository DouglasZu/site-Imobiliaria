import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  deleteMany: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    JWT_SECRET: "unit-test-secret-with-more-than-32-characters",
    NODE_ENV: "production",
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

import { consumeLoginRateLimit, getClientIp } from "@/lib/rate-limit";

describe("orquestração do rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.transaction.mockImplementation(
      async (
        callback: (transaction: {
          rateLimitBucket: {
            deleteMany: typeof mocks.deleteMany;
            upsert: typeof mocks.upsert;
          };
        }) => Promise<unknown>
      ) =>
        callback({
          rateLimitBucket: {
            deleteMany: mocks.deleteMany,
            upsert: mocks.upsert,
          },
        })
    );
  });

  it("interrompe no bucket de IP antes de criar buckets por conta", async () => {
    mocks.upsert.mockResolvedValue({ count: 11 });

    const decision = await consumeLoginRateLimit({
      ip: "203.0.113.10",
      account: "different@example.test",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.violatedScopes).toEqual(["ip"]);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it("consome conta e global somente depois que o IP é aceito", async () => {
    mocks.upsert.mockResolvedValue({ count: 1 });

    const decision = await consumeLoginRateLimit({
      ip: "203.0.113.10",
      account: "admin@example.test",
    });

    expect(decision.allowed).toBe(true);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).toHaveBeenCalledTimes(3);
  });

  it("prioriza o IP protegido pela Vercel e rejeita entradas malformadas", () => {
    const request = new NextRequest("https://example.test/api/auth/login", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.4",
        "x-forwarded-for": "203.0.113.9",
      },
    });
    const malformed = new NextRequest("https://example.test/api/auth/login", {
      headers: { "x-vercel-forwarded-for": "not-an-ip" },
    });

    expect(getClientIp(request)).toBe("198.51.100.4");
    expect(getClientIp(malformed)).toBe("unknown");
  });
});
