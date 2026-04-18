import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { CatalogFilters } from "@/components/storefront/catalogFilters";
import { CatalogPagination } from "@/components/storefront/catalogPagination";
import { CatalogToolbar } from "@/components/storefront/catalogToolbar";
import { EmptyState } from "@/components/storefront/emptyState";
import { ProductCard } from "@/components/storefront/productCard";
import { buildMetadata } from "@/lib/seo";
import { findCategoryBySlug, getBrands, getCategoryTree, getProducts } from "@/lib/storefrontApi";
import { collectCategoryIds, normalizeCatalogParams } from "@/lib/catalog";

export const dynamic = "force-dynamic";

function buildProductsCanonicalPath(params: ReturnType<typeof normalizeCatalogParams>) {
  const searchParams = new URLSearchParams();

  if (params.category) {
    searchParams.set("category", params.category);
  }
  if (params.brand) {
    searchParams.set("brand", params.brand);
  }
  if (params.shop) {
    searchParams.set("shop", params.shop);
  }
  if (params.search) {
    searchParams.set("search", params.search);
  }
  if (params.sort && params.sort !== "newest") {
    searchParams.set("sort", params.sort);
  }
  if (params.minPrice) {
    searchParams.set("minPrice", params.minPrice);
  }
  if (params.maxPrice) {
    searchParams.set("maxPrice", params.maxPrice);
  }
  if (params.tag) {
    searchParams.set("tag", params.tag);
  }
  if (params.inStock === "true") {
    searchParams.set("inStock", "true");
  }
  if (params.page && params.page !== "1") {
    searchParams.set("page", params.page);
  }

  return searchParams.size > 0 ? `/products?${searchParams.toString()}` : "/products";
}

export async function generateMetadata({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeCatalogParams(resolvedParams);
  const categories = params.category ? await getCategoryTree() : [];
  const category = params.category ? findCategoryBySlug(categories, params.category) : null;

  const title = params.search
    ? `Search results for "${params.search}"`
    : category
      ? `${category.name} products`
      : "Browse products";
  const description = category?.description
    ? `${category.description} Explore live marketplace inventory, compare prices, and filter active listings.`
    : params.search
      ? `Search the marketplace for ${params.search} with brand, price, shop, and stock filters.`
      : "Browse all active marketplace products with sorting, price filters, shop filters, and category-aware navigation.";

  return buildMetadata({
    title,
    description,
    path: buildProductsCanonicalPath(params),
    keywords: [
      "products",
      "catalog",
      category?.name ?? "",
      params.search ?? "",
      params.brand ?? "",
      params.shop ?? ""
    ].filter(Boolean)
  });
}

export default async function ProductsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeCatalogParams(resolvedParams);
  const categorySlug = params.category;

  const [categories, brands] = await Promise.all([getCategoryTree(), getBrands()]);
  const category = categorySlug ? findCategoryBySlug(categories, categorySlug) : null;
  const categoryIds = category ? collectCategoryIds(category).join(",") : undefined;
  const products = await getProducts({
    categoryIds,
    brandSlug: params.brand,
    shopSlug: params.shop,
    search: params.search,
    sort: params.sort,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    tag: params.tag,
    inStockOnly: params.inStock === "true" ? "true" : undefined,
    page: params.page
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
          <p className="max-w-3xl text-sm text-slate-500">
            {category?.description ??
              "Browse the marketplace inventory with category-aware entry points, URL-driven filters, and richer sort options for the storefront."}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
          <Link
            href={"/" as Route}
            className="font-medium text-orange-600 transition hover:text-orange-700"
          >
            Storefront
          </Link>
          <span>/</span>
          <span>{category ? category.name : "Catalog"}</span>
          {params.search ? (
            <>
              <span>/</span>
              <span>Search: “{params.search}”</span>
            </>
          ) : null}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
          <CatalogFilters
            categories={categories}
            brands={brands}
            currentCategorySlug={categorySlug}
            currentParams={params}
          />

          <div className="space-y-6">
            <CatalogToolbar
              total={products.pagination.total}
              currentParams={params}
              title={category ? category.name : "All products"}
            />

            {products.items.length > 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {products.items.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                <CatalogPagination
                  page={products.pagination.page}
                  totalPages={products.pagination.totalPages}
                  currentParams={params}
                />
              </>
            ) : (
              <EmptyState
                title="No products match this catalog query"
                description="Try broadening the price range, switching categories, or clearing the current search filters."
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
