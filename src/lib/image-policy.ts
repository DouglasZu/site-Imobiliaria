export const PROPERTY_IMAGE_HOSTNAME = "images.unsplash.com";
export const PROPERTY_IMAGE_MAX_URL_LENGTH = 2048;
export const PROPERTY_IMAGE_MAX_COUNT = 12;

export const PROPERTY_IMAGE_REMOTE_PATTERNS = [
  {
    protocol: "https" as const,
    hostname: PROPERTY_IMAGE_HOSTNAME,
    port: "",
    pathname: "/**",
  },
];

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
