import "server-only";

const LOCAL_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): URL {
  const configuredUrl =
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (!configuredUrl) return new URL(LOCAL_SITE_URL);

  const withProtocol = configuredUrl.startsWith("http://") || configuredUrl.startsWith("https://")
    ? configuredUrl
    : `https://${configuredUrl}`;

  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error("unsupported protocol");
    }
    if (
      process.env.NODE_ENV === "production" &&
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ) {
      throw new Error("insecure production URL");
    }
    return url;
  } catch {
    throw new Error("SITE_URL inválida.");
  }
}
