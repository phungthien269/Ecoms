import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/storefront/emptyState";
import { buildMetadata } from "@/lib/seo";
import { getPublicShops } from "@/lib/storefrontApi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Browse shops",
  description:
    "Discover active seller storefronts across the marketplace, compare shop catalogs, and jump directly into each public shop page.",
  path: "/shops",
  keywords: ["shops", "seller directory", "marketplace"]
});

export default async function ShopsDirectoryPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const search = String(resolvedParams.search ?? "").trim().toLowerCase();
  const shops = await getPublicShops();
  const filteredShops = search
    ? shops.filter(
        (shop) =>
          shop.name.toLowerCase().includes(search) ||
          (shop.description ?? "").toLowerCase().includes(search)
      )
    : shops;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Seller directory
            </p>
            <h1 className="text-3xl font-black text-slate-950">Browse marketplace shops</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Explore active storefronts, compare brand voices, and jump straight into each seller catalog.
            </p>
          </div>

          <form action="/shops" className="flex w-full max-w-md gap-3">
            <input
              name="search"
              defaultValue={search}
              placeholder="Search shop name or description..."
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Search
            </button>
          </form>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
          <Link href={"/" as Route} className="font-medium text-orange-600 transition hover:text-orange-700">
            Storefront
          </Link>
          <span>/</span>
          <span>Shops</span>
          {search ? (
            <>
              <span>/</span>
              <span>Search: “{search}”</span>
            </>
          ) : null}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredShops.length > 0 ? (
            filteredShops.map((shop) => (
              <Link
                key={shop.id}
                href={`/shops/${shop.slug}` as Route}
                className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="h-40 bg-gradient-to-br from-orange-400 via-red-500 to-amber-300">
                  {shop.bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shop.bannerUrl} alt={shop.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex items-center gap-4">
                    <div className="-mt-12 h-20 w-20 overflow-hidden rounded-[1.5rem] border-4 border-white bg-slate-100">
                      {shop.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={shop.logoUrl} alt={shop.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-bold text-slate-950">{shop.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{shop.productCount} active products</div>
                    </div>
                  </div>
                  <p className="line-clamp-3 text-sm leading-7 text-slate-600">
                    {shop.description ?? "This seller storefront is active and ready for catalog discovery."}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="sm:col-span-2 xl:col-span-3">
              <EmptyState
                title="No matching shops"
                description="Try a broader keyword or clear the current shop search query."
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
