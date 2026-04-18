import type { Route } from "next";
import Link from "next/link";
import { removeFromWishlistAction } from "@/app/actions/commerce";
import { formatPrice } from "@/components/commerce/price";
import { FlashBanner } from "@/components/layout/flashBanner";
import { EmptyState } from "@/components/storefront/emptyState";
import { getWishlist } from "@/lib/commerceApi";
import { readFlash } from "@/lib/feedback";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function WishlistPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const flash = readFlash((await searchParams) ?? {});
  const wishlist = await getWishlist();

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login to inspect wishlist"
          description="Use the buyer demo login in the top navigation to save favorite products."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <FlashBanner {...flash} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
            Wishlist
          </p>
          <h1 className="text-3xl font-black text-slate-950">Saved favorites</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Buyer-side favorites are now persisted through the live wishlist API.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {wishlist.length > 0 ? (
            wishlist.map((item) => (
              <section
                key={item.id}
                className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-24 w-24 overflow-hidden rounded-[1.5rem] bg-slate-100">
                      {item.product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.product.imageUrl} alt={item.product.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div>
                      <Link href={`/products/${item.product.slug}` as Route} className="text-lg font-bold text-slate-950">
                        {item.product.name}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.product.shop.name} • {item.product.soldCount} sold • {item.product.ratingAverage}/5
                      </p>
                      <p className="mt-2 text-lg font-black text-slate-950">
                        {formatPrice(item.product.salePrice)}
                      </p>
                    </div>
                  </div>
                  <form action={removeFromWishlistAction}>
                    <input type="hidden" name="productId" value={item.product.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </section>
            ))
          ) : (
            <EmptyState
              title="No wishlist items yet"
              description="Save a product from the detail page and it will show up here."
            />
          )}
        </div>
      </div>
    </main>
  );
}
