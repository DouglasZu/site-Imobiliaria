import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = "lar-imoveis";
const AUDIENCE = "lar-imoveis-admin";
const SESSION_DURATION_SECONDS = 60 * 60 * 24;

export const AUTH_COOKIE_NAME =
  env.NODE_ENV === "production" ? "__Host-admin-session" : "admin-token";

export interface AdminJWTPayload extends JoseJWTPayload {
  sub: string;
}

export interface CurrentAdmin {
  id: string;
  email: string;
}

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}

/** Sign a minimal, short-lived admin session token. */
export async function signToken(adminId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(adminId)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(JWT_SECRET);
}

/** Verify the token signature and all claims used for authorization. */
export async function verifyToken(token: string): Promise<AdminJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      requiredClaims: ["sub", "iat", "exp"],
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }

    return payload as AdminJWTPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
    priority: "high",
  });
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value;
}

export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);

  // Remove the pre-hardening cookie after a production deployment, too.
  if (AUTH_COOKIE_NAME !== "admin-token") {
    cookieStore.delete("admin-token");
  }
}

/**
 * Resolve the authenticated admin from the database. A valid JWT alone is not
 * authorization: deleting the admin immediately invalidates future requests.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const token = await getAuthCookie();
  if (!token) return null;

  const claims = await verifyToken(token);
  if (!claims) return null;

  // Keep Prisma out of the proxy bundle, which only needs verifyToken().
  const { prisma } = await import("@/lib/prisma");
  return prisma.admin.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true },
  });
}

export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new UnauthorizedError();
  return admin;
}
