import type { NextConfig } from "next";
import { PROPERTY_IMAGE_REMOTE_PATTERNS } from "./src/lib/image-policy";

const isProduction = process.env.NODE_ENV === "production";

const commonSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [...PROPERTY_IMAGE_REMOTE_PATTERNS],
    maximumRedirects: 0,
  },
  async headers() {
    const productionHeaders = isProduction
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
        ]
      : [];

    return [
      {
        source: "/(.*)",
        headers: [...commonSecurityHeaders, ...productionHeaders],
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
