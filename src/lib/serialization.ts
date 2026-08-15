import "server-only";

import { getR2PublicUrl } from "@/lib/storage/r2";

export function canonicalizePropertyImages<
  T extends { images: readonly { url: string; storageKey?: string | null }[] },
>(property: T): T {
  return {
    ...property,
    images: property.images.map((image) =>
      image.storageKey ? { ...image, url: getR2PublicUrl(image.storageKey) } : image
    ),
  } as T;
}

export function serializeProperty<
  T extends {
    price: { toString(): string } | string | number;
    images: readonly { url: string; storageKey?: string | null }[];
  },
>(
  property: T
) {
  return {
    ...canonicalizePropertyImages(property),
    price: property.price.toString(),
  };
}
