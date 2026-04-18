import type { Route } from "next";
import Link from "next/link";
import { createReportAction } from "@/app/actions/commerce";
import { EmptyState } from "@/components/storefront/emptyState";
import { getShop } from "@/lib/storefrontApi";

function formatPrice(value: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(value));
}

export const dynamic = "force-dynamic";

export default async function ShopDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const shop = await getShop(slug);

  if (!shop) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Shop not available"
          description="The shop page is wired, but the requested shop could not be loaded from the API."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href={"/" as Route} className="text-sm font-medium text-orange-600 hover:text-orange-700">
          Back to storefront
        </Link>

        <section className="mt-4 overflow-hidden rounded-[2rem] bg-white shadow-sm">
          <div className="h-48 bg-gradient-to-br from-orange-400 via-red-500 to-amber-300">
            {shop.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.bannerUrl} alt={shop.name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="-mt-16 h-28 w-28 overflow-hidden rounded-[1.5rem] border-4 border-white bg-slate-100">
              {shop.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logoUrl} alt={shop.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-slate-950">{shop.name}</h1>
              <p className="text-sm text-slate-500">Managed by {shop.owner.fullName}</p>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                {shop.description ?? "This seller storefront is ready for product merchandising."}
              </p>
              <div className="pt-2">
                <Link
                  href={`/products?shop=${shop.slug}` as Route}
                  className="text-sm font-semibold text-orange-600 transition hover:text-orange-700"
                >
                  View full shop catalog
                </Link>
              </div>
              <form action={createReportAction} className="pt-3">
                <input type="hidden" name="targetType" value="SHOP" />
                <input type="hidden" name="targetId" value={shop.id} />
                <input type="hidden" name="redirectTo" value={`/shops/${shop.slug}`} />
                <div className="flex flex-col gap-3 lg:flex-row">
                  <input
                    name="reason"
                    placeholder="Report this shop"
                    className="rounded-full border border-red-200 px-4 py-3 text-sm text-slate-700"
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    Submit shop report
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        <section className="mt-8 space-y-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-orange-500">
              Shop products
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Latest listings</h2>
          </div>

          {shop.products.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {shop.products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}` as Route}
                  className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="aspect-square bg-slate-100">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="space-y-3 p-4">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-900">{product.name}</p>
                    <div className="flex items-end gap-2">
                      <span className="text-lg font-bold text-orange-600">
                        {formatPrice(product.salePrice)}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        {formatPrice(product.originalPrice)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No active products in this shop"
              description="The shop page is ready. Product cards will appear once the API returns shop inventory."
            />
          )}
        </section>
      </div>
    </main>
  );
}
