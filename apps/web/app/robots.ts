import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/seller",
        "/cart",
        "/checkout",
        "/orders",
        "/wishlist",
        "/chat",
        "/notifications",
        "/account"
      ]
    },
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
