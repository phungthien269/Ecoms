import type { Metadata } from "next";
import { StorefrontShell } from "@/components/layout/storefrontShell";
import { buildMetadata } from "@/lib/seo";
import {
  getActiveFlashSales,
  getCategoryTree,
  getHomeBanners,
  getProducts
} from "@/lib/storefrontApi";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildMetadata({
  title: "Marketplace home",
  description:
    "Discover trending products, flash sales, hero banners, and marketplace categories across the Ecoms storefront.",
  path: "/",
  keywords: ["marketplace", "flash sale", "shopping", "ecommerce", "viet nam"]
});

export default async function HomePage() {
  const [categories, products, flashSales, banners] = await Promise.all([
    getCategoryTree(),
    getProducts(),
    getActiveFlashSales(),
    getHomeBanners()
  ]);

  return (
    <StorefrontShell
      categories={categories}
      products={products.items}
      flashSales={flashSales}
      banners={banners}
    />
  );
}
