import { createHmac } from "node:crypto";

export interface RateLimitRule {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
}

export interface PreparedRateLimitRule {
  scope: string;
  key: string;
  limit: number;
  expiresAt: Date;
}

export interface RateLimitCounter extends PreparedRateLimitRule {
  count: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  violatedScopes: string[];
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

/** Convert raw rate-limit identifiers into fixed-window, pseudonymous keys. */
export function prepareRateLimitRules(
  rules: readonly RateLimitRule[],
  secret: string,
  now: Date
): PreparedRateLimitRule[] {
  if (secret.length < 32) {
    throw new RangeError("Rate-limit HMAC secret must have at least 32 characters");
  }

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new RangeError("now must be valid");

  return rules.map((rule) => {
    if (rule.scope.length === 0 || rule.identifier.length === 0) {
      throw new RangeError("Rate-limit scope and identifier cannot be empty");
    }

    assertPositiveInteger(rule.limit, "limit");
    assertPositiveInteger(rule.windowMs, "windowMs");

    const windowStart = Math.floor(nowMs / rule.windowMs) * rule.windowMs;
    const digest = createHmac("sha256", secret)
      .update("lar-imoveis:rate-limit:v1\0")
      .update(rule.scope)
      .update("\0")
      .update(rule.identifier)
      .update("\0")
      .update(String(windowStart))
      .digest("hex");

    return {
      scope: rule.scope,
      key: `rate:${rule.scope}:${digest}`,
      limit: rule.limit,
      expiresAt: new Date(windowStart + rule.windowMs),
    };
  });
}

/** Decide after counters have been atomically incremented. */
export function evaluateRateLimitCounters(
  counters: readonly RateLimitCounter[],
  now: Date
): RateLimitDecision {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new RangeError("now must be valid");

  const violated = counters.filter((counter) => counter.count > counter.limit);
  if (violated.length === 0) {
    return { allowed: true, retryAfterSeconds: 0, violatedScopes: [] };
  }

  const retryAfterSeconds = Math.max(
    1,
    ...violated.map((counter) =>
      Math.ceil(Math.max(0, counter.expiresAt.getTime() - nowMs) / 1_000)
    )
  );

  return {
    allowed: false,
    retryAfterSeconds,
    violatedScopes: [...new Set(violated.map((counter) => counter.scope))],
  };
}
