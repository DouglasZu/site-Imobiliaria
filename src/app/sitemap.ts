import type { MetadataRoute } from "next";
import { findActivePropertiesForSitemap } from "@/lib/queries/property";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const properties = await findActivePropertiesForSitemap();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: new URL("/", siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/properties", siteUrl).toString(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  return [
    ...staticRoutes,
    ...properties.map((property) => ({
      url: new URL(`/properties/${property.id}`, siteUrl).toString(),
      lastModified: property.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
