import { placeOrderAction } from "@/app/actions/commerce";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { getCart, getCheckoutPreview } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const defaultCheckoutPayload = {
  paymentMethod: "COD",
  shippingAddress: {
    recipientName: "Demo Buyer",
    phoneNumber: "0900000000",
    addressLine1: "123 Demo Street",
    district: "District 1",
    province: "Ho Chi Minh City",
    regionCode: "HCM"
  }
};

export default async function CheckoutPage() {
  const session = await getDemoSession();
  const cart = await getCart();
  const preview = await getCheckoutPreview(defaultCheckoutPayload);

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login to test checkout"
          description="Use the buyer demo login in the top navigation first, then return here."
        />
      </main>
    );
  }

  if (!cart || cart.shops.length === 0 || !preview) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Checkout needs cart items"
          description="Add the demo product to cart first, then revisit this page for shipping and payment preview."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
            Checkout
          </p>
          <h1 className="text-3xl font-black text-slate-950">Marketplace checkout preview</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            This screen uses the live preview API and currently places one order per shop.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <form action={placeOrderAction} className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Shipping address</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Defaults are pre-filled for the local buyer demo session.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <input name="recipientName" defaultValue="Demo Buyer" className={inputClass} />
                  <input name="phoneNumber" defaultValue="0900000000" className={inputClass} />
                  <input
                    name="addressLine1"
                    defaultValue="123 Demo Street"
                    className={`${inputClass} sm:col-span-2`}
                  />
                  <input name="addressLine2" placeholder="Apartment / building (optional)" className={inputClass} />
                  <input name="ward" placeholder="Ward (optional)" className={inputClass} />
                  <input name="district" defaultValue="District 1" className={inputClass} />
                  <input name="province" defaultValue="Ho Chi Minh City" className={inputClass} />
                  <select name="regionCode" defaultValue="HCM" className={inputClass}>
                    <option value="HCM">Ho Chi Minh City</option>
                    <option value="HN">Ha Noi</option>
                    <option value="CENTRAL">Central</option>
                    <option value="OTHER">Other province</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Payment method</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      value: "COD",
                      label: "Cash on delivery",
                      description: "Creates confirmed orders immediately."
                    },
                    {
                      value: "BANK_TRANSFER",
                      label: "Mock bank transfer",
                      description: "Creates pending payment for manual confirmation."
                    },
                    {
                      value: "ONLINE_GATEWAY",
                      label: "Mock gateway",
                      description: "Creates pending payment for callback simulation."
                    }
                  ].map((method) => (
                    <label
                      key={method.value}
                      className="rounded-[1.5rem] border border-slate-200 p-4 text-sm text-slate-600"
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.value}
                        defaultChecked={method.value === "COD"}
                        className="mb-3"
                      />
                      <div className="font-semibold text-slate-950">{method.label}</div>
                      <div className="mt-1">{method.description}</div>
                    </label>
                  ))}
                </div>
                <textarea
                  name="note"
                  placeholder="Optional note for the seller"
                  rows={3}
                  className={`${inputClass} min-h-28 rounded-[1.5rem]`}
                />
              </div>
            </section>

            <button
              type="submit"
              className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Place demo order
            </button>
          </form>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Preview totals</h2>
              <div className="mt-4 space-y-4">
                {preview.shops.map((shop) => (
                  <div key={shop.shop.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                    <div className="font-semibold text-slate-950">{shop.shop.name}</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between gap-4">
                        <span>Items</span>
                        <span>{formatPrice(shop.itemsSubtotal)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Shipping</span>
                        <span>{formatPrice(shop.shippingFee)}</span>
                      </div>
                      <div className="flex justify-between gap-4 font-semibold text-slate-950">
                        <span>Shop total</span>
                        <span>{formatPrice(shop.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6">
              <div className="space-y-3">
                <div className="flex justify-between gap-4 text-sm text-slate-600">
                  <span>Items subtotal</span>
                  <span>{formatPrice(preview.totals.itemsSubtotal)}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm text-slate-600">
                  <span>Shipping fee</span>
                  <span>{formatPrice(preview.totals.shippingFee)}</span>
                </div>
                <div className="flex justify-between gap-4 text-lg font-black text-slate-950">
                  <span>Grand total</span>
                  <span>{formatPrice(preview.totals.grandTotal)}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

const inputClass =
  "rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400";
