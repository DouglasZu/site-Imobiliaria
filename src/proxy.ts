import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";

function createContentSecurityPolicy(nonce: string) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2BucketName = process.env.R2_BUCKET_NAME;
  const r2ApiOrigins =
    r2AccountId && /^[a-f0-9]{32}$/i.test(r2AccountId)
      ? [
          `https://${r2AccountId}.r2.cloudflarestorage.com`,
          ...(r2BucketName && /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(r2BucketName)
            ? [`https://${r2BucketName}.${r2AccountId}.r2.cloudflarestorage.com`]
            : []),
        ]
      : [];
  const r2PublicOrigin = getSafeHttpsOrigin(process.env.R2_PUBLIC_URL);
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  const pusherWebSocket =
    pusherCluster && /^[a-z0-9-]{2,20}$/.test(pusherCluster)
      ? `wss://ws-${pusherCluster}.pusher.com`
      : null;

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDevelopment ? " 'unsafe-eval'" : ""
    }`,
    // React style attributes are still used extensively. Script execution is
    // nonce-restricted while styles are migrated incrementally to classes.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: https://images.unsplash.com https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org${
      r2PublicOrigin ? ` ${r2PublicOrigin}` : ""
    }`,
    `connect-src 'self' https://nominatim.openstreetmap.org${
      r2ApiOrigins.length ? ` ${r2ApiOrigins.join(" ")}` : ""
    }${pusherWebSocket ? ` ${pusherWebSocket}` : ""}${isDevelopment ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function getSafeHttpsOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  const nonce = Buffer.from(randomUUID()).toString("base64");
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const { pathname } = request.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPublicLogin = pathname === "/admin/login";

  if (isAdminPath && !isPublicLogin) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const claims = token ? await verifyToken(token) : null;

    if (!claims) {
      const response = NextResponse.redirect(
        new URL("/admin/login", request.url)
      );
      response.headers.set("Content-Security-Policy", contentSecurityPolicy);
      if (token) response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
