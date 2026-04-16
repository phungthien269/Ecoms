import type { Route } from "next";
import Link from "next/link";
import { CategoryRail } from "@/components/storefront/categoryRail";
import { EmptyState } from "@/components/storefront/emptyState";
import { ProductCard } from "@/components/storefront/productCard";
import type { CategoryNode, ProductCard as ProductCardType } from "@/lib/storefrontTypes";

export function StorefrontShell({
  categories,
  products
}: {
  categories: CategoryNode[];
  products: ProductCardType[];
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff7f3_0%,#ffffff_28%,#fffaf5_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] bg-slate-950 text-slate-50 shadow-2xl shadow-orange-200/50">
          <div className="grid gap-8 px-6 py-10 lg:grid-cols-[1.3fr_0.7fr] lg:px-10">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-orange-300/30 bg-orange-500/10 px-3 py-1 text-sm text-orange-200">
                Ecoms marketplace storefront
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                  Shopee-inspired shopping flows with a cleaner storefront surface.
                </h1>
                <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
                  Browse the latest seeded products, jump into shop pages, and pressure-test the
                  marketplace structure before checkout, voucher, and payment flows land.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={"/products" as Route}
                  className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Browse products
                </Link>
                <Link
                  href={"/categories/electronics" as Route}
                  className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-orange-400 hover:text-orange-200"
                >
                  Explore electronics
                </Link>
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-white/5 p-6 backdrop-blur">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-orange-200">Live slices</p>
                <div className="grid gap-3">
                  {[
                    "Auth + RBAC baseline",
                    "Category, brand, shop, product APIs",
                    "Product variants and publish guardrails"
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-orange-500">
                Categories
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Start from popular aisles</h2>
            </div>
          </div>
          <CategoryRail categories={categories} />
        </section>

        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-orange-500">
                Products
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">New on the storefront</h2>
            </div>
            <Link
              href={"/products" as Route}
              className="text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              View all
            </Link>
          </div>

          {products.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Storefront is ready for inventory"
              description="Once the API is seeded against a live database, featured products will render here."
            />
          )}
        </section>
      </div>
    </main>
  );
}
