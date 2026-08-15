export const PROPERTY_IMAGE_HOSTNAME = "images.unsplash.com";
export const PROPERTY_IMAGE_MAX_URL_LENGTH = 2_048;
export const PROPERTY_IMAGE_MAX_COUNT = 12;
export const PROPERTY_IMAGE_MAX_BYTES = 10 * 1_024 * 1_024;

export const PROPERTY_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PropertyImageContentType = (typeof PROPERTY_IMAGE_CONTENT_TYPES)[number];

export const PROPERTY_IMAGE_REMOTE_PATTERNS = [
  {
    protocol: "https" as const,
    hostname: PROPERTY_IMAGE_HOSTNAME,
    port: "",
    pathname: "/**",
  },
];

export function getR2ImageRemotePattern(publicUrl: string | undefined) {
  if (!publicUrl) return null;
  try {
    const url = new URL(publicUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      return null;
    }
    return {
      protocol: "https" as const,
      hostname: url.hostname,
      port: url.port,
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

export function isAllowedPropertyImageUrl(value: string): boolean {
  if (!value || value.length > PROPERTY_IMAGE_MAX_URL_LENGTH) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === PROPERTY_IMAGE_HOSTNAME &&
      url.port === "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

export function isManagedStorageKey(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      /^properties\/[A-Za-z0-9_-]{1,64}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(value)
  );
}

export function isRenderablePropertyImage(image: {
  url: string;
  storageKey?: string | null;
}): boolean {
  if (isManagedStorageKey(image.storageKey)) {
    try {
      return new URL(image.url).protocol === "https:";
    } catch {
      return false;
    }
  }
  return isAllowedPropertyImageUrl(image.url);
}

export function getPropertyImageUrlError(value: string): string | null {
  if (!value.trim()) return "Informe a URL da imagem.";
  if (value.length > PROPERTY_IMAGE_MAX_URL_LENGTH) {
    return `A URL deve ter no máximo ${PROPERTY_IMAGE_MAX_URL_LENGTH} caracteres.`;
  }
  if (!isAllowedPropertyImageUrl(value)) {
    return `Use uma URL HTTPS de ${PROPERTY_IMAGE_HOSTNAME}.`;
  }
  return null;
}
