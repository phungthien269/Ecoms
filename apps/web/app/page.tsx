import type { Metadata } from "next";
import { FlashBanner } from "@/components/layout/flashBanner";
import { StorefrontShell } from "@/components/layout/storefrontShell";
import { readFlash } from "@/lib/feedback";
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

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const flash = readFlash((await searchParams) ?? {});
  const [categories, products, flashSales, banners] = await Promise.all([
    getCategoryTree(),
    getProducts(),
    getActiveFlashSales(),
    getHomeBanners()
  ]);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <FlashBanner {...flash} />
      </div>
      <StorefrontShell
        categories={categories}
        products={products.items}
        flashSales={flashSales}
        banners={banners}
      />
    </>
  );
}
