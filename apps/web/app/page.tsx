import { StorefrontShell } from "@/components/layout/storefrontShell";
import {
  getActiveFlashSales,
  getCategoryTree,
  getHomeBanners,
  getProducts
} from "@/lib/storefrontApi";

export const dynamic = "force-dynamic";

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
