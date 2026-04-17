import type { Route } from "next";
import Link from "next/link";
import { CategoryRail } from "@/components/storefront/categoryRail";
import { EmptyState } from "@/components/storefront/emptyState";
import { ProductCard } from "@/components/storefront/productCard";
import type {
  CategoryNode,
  ProductCard as ProductCardType,
  StorefrontBanner,
  StorefrontFlashSale
} from "@/lib/storefrontTypes";

export function StorefrontShell({
  categories,
  products,
  flashSales,
  banners
}: {
  categories: CategoryNode[];
  products: ProductCardType[];
  flashSales: StorefrontFlashSale[];
  banners: StorefrontBanner[];
}) {
  const heroBanner = banners[0] ?? null;
  const secondaryBanners = banners.slice(1, 4);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff7f3_0%,#ffffff_28%,#fffaf5_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] bg-slate-950 text-slate-50 shadow-2xl shadow-orange-200/50">
          <div className="grid gap-8 px-6 py-10 lg:grid-cols-[1.3fr_0.7fr] lg:px-10">
            <div
              className="space-y-6 rounded-[1.75rem] bg-cover bg-center p-6"
              style={
                heroBanner
                  ? {
                      backgroundImage: `linear-gradient(135deg, rgba(15,23,42,0.88), rgba(249,115,22,0.45)), url(${heroBanner.imageUrl})`
                    }
                  : undefined
              }
            >
              <div className="inline-flex rounded-full border border-orange-300/30 bg-orange-500/10 px-3 py-1 text-sm text-orange-200">
                {heroBanner ? "Live homepage banner" : "Ecoms marketplace storefront"}
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                  {heroBanner?.title ??
                    "Shopee-inspired shopping flows with a cleaner storefront surface."}
                </h1>
                <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
                  {heroBanner?.description ??
                    "Browse the latest seeded products, jump into shop pages, and pressure-test the marketplace structure before checkout, voucher, and payment flows land."}
                </p>
                {heroBanner?.subtitle ? (
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
                    {heroBanner.subtitle}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={(heroBanner?.linkUrl || "/products") as Route}
                  className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  {heroBanner?.linkUrl ? "Open campaign" : "Browse products"}
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
                <p className="text-xs uppercase tracking-[0.3em] text-orange-200">
                  {secondaryBanners.length > 0 ? "Campaign stack" : "Live slices"}
                </p>
                {secondaryBanners.length > 0 ? (
                  <div className="grid gap-3">
                    {secondaryBanners.map((banner) => (
                      <Link
                        key={banner.id}
                        href={(banner.linkUrl || "/products") as Route}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 transition hover:border-orange-300/40 hover:bg-white/10"
                      >
                        <div className="font-semibold text-white">{banner.title}</div>
                        {banner.subtitle ? (
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-orange-200">
                            {banner.subtitle}
                          </div>
                        ) : null}
                        {banner.description ? (
                          <div className="mt-2 text-sm text-slate-300">{banner.description}</div>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                ) : (
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
                )}
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

        {flashSales.length > 0 ? (
          <section className="mt-10 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.3em] text-red-500">
                  Flash Sale
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Timed deals running now</h2>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#ef4444_0%,#f97316_45%,#111827_100%)] p-6 text-white shadow-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-100">
                  {flashSales[0]?.name}
                </p>
                <h3 className="mt-3 text-3xl font-black">Drive urgency on high-intent products</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-orange-50">
                  {flashSales[0]?.description ??
                    "An active promotional campaign is currently live across seeded inventory."}
                </p>
                <div className="mt-5 text-sm font-medium text-orange-100">
                  Ends {new Date(flashSales[0]!.endsAt).toLocaleString("vi-VN")}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {flashSales[0]?.items.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    href={`/products/${item.productSlug}` as Route}
                    className="rounded-[1.75rem] border border-red-100 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="text-sm font-semibold text-slate-950">{item.productName}</div>
                    <div className="mt-3 text-lg font-black text-red-500">
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                        maximumFractionDigits: 0
                      }).format(Number(item.flashPrice))}
                    </div>
                    <div className="mt-1 text-xs text-slate-400 line-through">
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                        maximumFractionDigits: 0
                      }).format(Number(item.originalSalePrice))}
                    </div>
                    <div className="mt-3 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                      {item.remainingStock} left
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

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
