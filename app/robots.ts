import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://deluzexlighting.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/shop",
          "/product/",
          "/categories",
          "/about",
          "/contact",
          "/collaborate",
          "/projects",
          "/blogs",
        ],
        disallow: [
          "/admin/",
          "/dashboard/",
          "/api/",
          "/login",
          "/checkout",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
