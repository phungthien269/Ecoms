import { StorefrontShell } from "@/components/layout/storefrontShell";
import { getCategoryTree, getProducts } from "@/lib/storefrontApi";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, products] = await Promise.all([getCategoryTree(), getProducts()]);

  return <StorefrontShell categories={categories} products={products.items} />;
}
