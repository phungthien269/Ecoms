import type { Route } from "next";
import Link from "next/link";
import { removeCartItemAction, updateCartItemAction } from "@/app/actions/commerce";
import { formatPrice } from "@/components/commerce/price";
import { FlashBanner } from "@/components/layout/flashBanner";
import { EmptyState } from "@/components/storefront/emptyState";
import { getCart } from "@/lib/commerceApi";
import { readFlash } from "@/lib/feedback";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CartPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const flash = readFlash((await searchParams) ?? {});
  const cart = await getCart();

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login to inspect the demo cart"
          description="Use the buyer demo login in the top navigation, then come back here to test cart and checkout flows."
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Cart
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Buyer demo cart</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              The cart groups lines by shop to match marketplace checkout behavior.
            </p>
          </div>
          <Link
            href={"/checkout" as Route}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Continue to checkout
          </Link>
        </div>

        <div className="mt-8 space-y-6">
          {cart && cart.shops.length > 0 ? (
            <>
              {cart.shops.map((group) => (
                <section
                  key={group.shop.id}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
                        Shop
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-slate-950">{group.shop.name}</h2>
                    </div>
                    <Link
                      href={`/shops/${group.shop.slug}` as Route}
                      className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                    >
                      Visit shop
                    </Link>
                  </div>

                  <div className="mt-4 space-y-4">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100">
                            {item.product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <Link
                              href={`/products/${item.product.slug}` as Route}
                              className="text-base font-semibold text-slate-900 transition hover:text-orange-600"
                            >
                              {item.product.name}
                            </Link>
                            <p className="text-sm text-slate-500">
                              {item.variant ? `${item.variant.name} • ${item.variant.sku}` : item.product.status}
                            </p>
                            <p className="text-sm font-semibold text-orange-600">
                              {formatPrice(item.unitPrice)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <form action={updateCartItemAction} className="flex items-center gap-2">
                            <input type="hidden" name="cartItemId" value={item.id} />
                            <input
                              type="number"
                              name="quantity"
                              min={1}
                              defaultValue={item.quantity}
                              className="w-24 rounded-full border border-slate-200 px-4 py-2 text-sm"
                            />
                            <button
                              type="submit"
                              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                            >
                              Update
                            </button>
                          </form>

                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Subtotal</p>
                            <p className="text-lg font-bold text-slate-950">
                              {formatPrice(item.subtotal)}
                            </p>
                          </div>

                          <form action={removeCartItemAction}>
                            <input type="hidden" name="cartItemId" value={item.id} />
                            <button
                              type="submit"
                              className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <div className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                      Shop subtotal: {formatPrice(group.subtotal)}
                    </div>
                  </div>
                </section>
              ))}

              <section className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-600">
                      Cart total
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {formatPrice(cart.totals.subtotal)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {cart.totals.itemCount} items across {cart.shops.length} shop(s)
                    </p>
                  </div>
                  <Link
                    href={"/checkout" as Route}
                    className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    Preview checkout
                  </Link>
                </div>
              </section>
            </>
          ) : (
            <EmptyState
              title="Cart is empty"
              description="Add the demo product from the product detail page, then come back here to test checkout."
            />
          )}
        </div>
      </div>
    </main>
  );
}
