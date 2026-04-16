import { StorefrontShell } from "@/components/layout/storefrontShell";
import { getActiveFlashSales, getCategoryTree, getProducts } from "@/lib/storefrontApi";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, products, flashSales] = await Promise.all([
    getCategoryTree(),
    getProducts(),
    getActiveFlashSales()
  ]);

  return (
    <StorefrontShell
      categories={categories}
      products={products.items}
      flashSales={flashSales}
    />
  );
}
