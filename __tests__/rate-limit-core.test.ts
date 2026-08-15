import { describe, expect, it } from "vitest";
import {
  evaluateRateLimitCounters,
  prepareRateLimitRules,
} from "@/lib/rate-limit-core";

const SECRET = "test-rate-limit-secret-with-32-characters";
const NOW = new Date("2026-08-15T12:00:30.000Z");

describe("rate-limit core", () => {
  it("gera chaves determinísticas sem persistir o identificador bruto", () => {
    const rule = {
      scope: "account",
      identifier: "admin@example.test",
      limit: 10,
      windowMs: 60_000,
    };

    const first = prepareRateLimitRules([rule], SECRET, NOW)[0];
    const second = prepareRateLimitRules([rule], SECRET, NOW)[0];

    expect(first.key).toBe(second.key);
    expect(first.key).not.toContain(rule.identifier);
    expect(first.key).toMatch(/^rate:account:[a-f0-9]{64}$/);
  });

  it("separa identificadores, escopos e janelas", () => {
    const base = {
      scope: "ip",
      identifier: "192.0.2.1",
      limit: 10,
      windowMs: 60_000,
    };

    const first = prepareRateLimitRules([base], SECRET, NOW)[0];
    const otherIdentifier = prepareRateLimitRules(
      [{ ...base, identifier: "192.0.2.2" }],
      SECRET,
      NOW
    )[0];
    const otherScope = prepareRateLimitRules(
      [{ ...base, scope: "account" }],
      SECRET,
      NOW
    )[0];
    const nextWindow = prepareRateLimitRules(
      [base],
      SECRET,
      new Date(NOW.getTime() + 60_000)
    )[0];

    expect(
      new Set([first.key, otherIdentifier.key, otherScope.key, nextWindow.key]).size
    ).toBe(4);
  });

  it("permite até o limite inclusive", () => {
    const [prepared] = prepareRateLimitRules(
      [{ scope: "ip", identifier: "192.0.2.1", limit: 3, windowMs: 60_000 }],
      SECRET,
      NOW
    );

    expect(
      evaluateRateLimitCounters([{ ...prepared, count: 3 }], NOW)
    ).toEqual({ allowed: true, retryAfterSeconds: 0, violatedScopes: [] });
  });

  it("nega acima do limite e usa o maior Retry-After violado", () => {
    const decision = evaluateRateLimitCounters(
      [
        {
          scope: "account",
          key: "account-key",
          count: 11,
          limit: 10,
          expiresAt: new Date(NOW.getTime() + 30_001),
        },
        {
          scope: "ip",
          key: "ip-key",
          count: 31,
          limit: 30,
          expiresAt: new Date(NOW.getTime() + 90_001),
        },
      ],
      NOW
    );

    expect(decision).toEqual({
      allowed: false,
      retryAfterSeconds: 91,
      violatedScopes: ["account", "ip"],
    });
  });
});
