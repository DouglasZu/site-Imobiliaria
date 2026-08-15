import "server-only";

import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  evaluateRateLimitCounters,
  prepareRateLimitRules,
  type RateLimitDecision,
  type RateLimitRule,
} from "@/lib/rate-limit-core";

const MINUTE = 60_000;

const LOGIN_LIMITS = {
  // Keep an account-wide ceiling for distributed attacks without making a
  // targeted lockout cheap; the per-IP rule stops ordinary brute force first.
  account: { limit: 50, windowMs: 15 * MINUTE },
  ip: { limit: 10, windowMs: 15 * MINUTE },
  global: { limit: 300, windowMs: 5 * MINUTE },
} as const;

const LEAD_LIMITS = {
  ip: { limit: 5, windowMs: 15 * MINUTE },
  email: { limit: 3, windowMs: 30 * MINUTE },
  global: { limit: 100, windowMs: 5 * MINUTE },
} as const;

const UPLOAD_LIMITS = {
  ip: { limit: 30, windowMs: 15 * MINUTE },
  admin: { limit: 60, windowMs: 15 * MINUTE },
} as const;

function firstValidIp(value: string | null): string | null {
  if (!value) return null;

  for (const entry of value.split(",")) {
    const candidate = entry.trim();
    if (isIP(candidate) !== 0) return candidate;
  }

  return null;
}

/** Extract a bounded network identifier; it is HMACed before persistence. */
export function getClientIp(request: NextRequest): string {
  return (
    firstValidIp(request.headers.get("x-vercel-forwarded-for")) ??
    firstValidIp(request.headers.get("cf-connecting-ip")) ??
    firstValidIp(request.headers.get("x-forwarded-for")) ??
    firstValidIp(request.headers.get("x-real-ip")) ??
    "unknown"
  );
}

export async function consumeRateLimits(
  rules: readonly RateLimitRule[],
  now = new Date()
): Promise<RateLimitDecision> {
  const preparedRules = prepareRateLimitRules(rules, env.JWT_SECRET, now);

  const counters = await prisma.$transaction(async (transaction) => {
    await transaction.rateLimitBucket.deleteMany({
      where: { expiresAt: { lte: now } },
    });

    const updated = [];
    for (const rule of preparedRules) {
      const bucket = await transaction.rateLimitBucket.upsert({
        where: { key: rule.key },
        create: {
          key: rule.key,
          count: 1,
          expiresAt: rule.expiresAt,
        },
        update: { count: { increment: 1 } },
        select: { count: true },
      });

      updated.push({ ...rule, count: bucket.count });
    }

    return updated;
  });

  return evaluateRateLimitCounters(counters, now);
}

export async function consumeLoginRateLimit(input: {
  ip: string;
  account: string;
}): Promise<RateLimitDecision> {
  // Stop blocked sources before they can create arbitrary account buckets or
  // inflate the account/global counters with continued requests.
  const ipDecision = await consumeRateLimits([
    { scope: "ip", identifier: input.ip, ...LOGIN_LIMITS.ip },
  ]);
  if (!ipDecision.allowed) return ipDecision;

  return consumeRateLimits([
    {
      scope: "account",
      identifier: input.account,
      ...LOGIN_LIMITS.account,
    },
    { scope: "global", identifier: "all", ...LOGIN_LIMITS.global },
  ]);
}

export async function consumeLeadRateLimit(input: {
  ip: string;
  email: string;
}): Promise<RateLimitDecision> {
  const ipDecision = await consumeRateLimits([
    { scope: "lead-ip", identifier: input.ip, ...LEAD_LIMITS.ip },
  ]);
  if (!ipDecision.allowed) return ipDecision;

  return consumeRateLimits([
    { scope: "lead-email", identifier: input.email, ...LEAD_LIMITS.email },
    { scope: "lead-global", identifier: "all", ...LEAD_LIMITS.global },
  ]);
}

export async function consumeUploadRateLimit(input: {
  ip: string;
  adminId: string;
}): Promise<RateLimitDecision> {
  const ipDecision = await consumeRateLimits([
    { scope: "upload-ip", identifier: input.ip, ...UPLOAD_LIMITS.ip },
  ]);
  if (!ipDecision.allowed) return ipDecision;

  return consumeRateLimits([
    { scope: "upload-admin", identifier: input.adminId, ...UPLOAD_LIMITS.admin },
  ]);
}
