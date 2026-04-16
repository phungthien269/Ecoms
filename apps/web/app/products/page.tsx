import { EmptyState } from "@/components/storefront/emptyState";
import { ProductCard } from "@/components/storefront/productCard";
import { findCategoryBySlug, getCategoryTree, getProducts } from "@/lib/storefrontApi";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const categorySlug =
    typeof resolvedParams.category === "string" ? resolvedParams.category : undefined;
  const search = typeof resolvedParams.search === "string" ? resolvedParams.search : undefined;

  const categories = await getCategoryTree();
  const category = categorySlug ? findCategoryBySlug(categories, categorySlug) : null;
  const products = await getProducts({
    categoryId: category?.id,
    search
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-orange-500">
            Catalog
          </p>
          <h1 className="text-3xl font-black text-slate-950">
            {category ? category.name : "All products"}
          </h1>
          <p className="max-w-2xl text-sm text-slate-500">
            {category?.description ??
              "Browse the marketplace inventory with category-aware entry points and product detail pages."}
          </p>
        </div>

        <div className="mt-8">
          {products.items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No products available yet"
              description="Seed data or run the API against a live database to populate this catalog."
            />
          )}
        </div>
      </div>
    </main>
  );
}
