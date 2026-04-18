import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateSellerOrderStatusAction } from "@/app/actions/seller";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { getSellerOrder } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const sellerTransitions: Record<string, string[]> = {
  PENDING: ["CONFIRMED"],
  CONFIRMED: ["PROCESSING"],
  PROCESSING: ["SHIPPING"],
  SHIPPING: ["DELIVERED", "DELIVERY_FAILED"],
  RETURN_REQUESTED: ["RETURNED"]
};

export default async function SellerOrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getDemoSession();
  const { orderId } = await params;

  if (!session || session.role !== "SELLER") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as seller demo to inspect order detail"
          description="Use Seller demo login, then reopen this page."
        />
      </main>
    );
  }

  const order = await getSellerOrder(orderId);
  if (!order) {
    notFound();
  }

  const nextStatuses = sellerTransitions[order.status] ?? [];
  const latestPayment = order.payments[0] ?? null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Seller Order Detail
            </p>
            <h1 className="text-3xl font-black text-slate-950">{order.orderNumber}</h1>
            <p className="text-sm text-slate-500">
              {order.customer.fullName} • {order.status} • {new Date(order.placedAt).toLocaleString("vi-VN")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={"/seller/orders" as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Back to queue
            </Link>
            <Link
              href={`/orders/${order.id}` as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Buyer view
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-950">Order items</h2>
                <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
                  {formatPrice(order.totals.grandTotal)}
                </div>
              </div>
              <div className="mt-4 space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-950">{item.productName}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {item.variantName ?? "Default"} • {item.productSku}
                        </div>
                        {item.variantAttributes ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Object.entries(item.variantAttributes).map(([key, value]) => (
                              <div
                                key={`${item.id}-${key}`}
                                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                              >
                                {key}: {value}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-orange-600">
                          {formatPrice(item.subtotal)}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">Qty {item.quantity}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Lifecycle timeline</h2>
              <div className="mt-5 space-y-4">
                {order.statusTimeline.map((entry) => (
                  <div key={entry.id} className="flex gap-4">
                    <div className="mt-1 h-3 w-3 rounded-full bg-orange-500" />
                    <div className="min-w-0 flex-1 rounded-[1.5rem] bg-slate-50 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-semibold text-slate-950">
                          {entry.status.replaceAll("_", " ")}
                        </div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                          {new Date(entry.createdAt).toLocaleString("vi-VN")}
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {entry.actorUser?.fullName
                          ? `${entry.actorType} • ${entry.actorUser.fullName}`
                          : entry.actorType}
                      </div>
                      {entry.note ? (
                        <div className="mt-2 text-sm text-slate-600">{entry.note}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Buyer</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="font-semibold text-slate-950">{order.customer.fullName}</div>
                <div>{order.customer.email}</div>
                <div>{order.customer.phoneNumber ?? "No phone number"}</div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Shipping address</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="font-semibold text-slate-950">{order.shippingAddress.recipientName}</div>
                <div>{order.shippingAddress.phoneNumber}</div>
                <div>{order.shippingAddress.addressLine1}</div>
                {order.shippingAddress.addressLine2 ? <div>{order.shippingAddress.addressLine2}</div> : null}
                {order.shippingAddress.ward ? <div>{order.shippingAddress.ward}</div> : null}
                <div>
                  {order.shippingAddress.district}, {order.shippingAddress.province}
                </div>
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  {order.shippingAddress.regionCode}
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-orange-100 bg-orange-50 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Payment + actions</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="font-semibold text-slate-950">{order.paymentMethod}</div>
                <div>
                  {latestPayment
                    ? `${latestPayment.status} • ${latestPayment.referenceCode}`
                    : "No payment record"}
                </div>
                {latestPayment?.paidAt ? (
                  <div>Paid at {new Date(latestPayment.paidAt).toLocaleString("vi-VN")}</div>
                ) : null}
                {latestPayment?.expiresAt ? (
                  <div>Expires at {new Date(latestPayment.expiresAt).toLocaleString("vi-VN")}</div>
                ) : null}
              </div>
              <div className="mt-5 space-y-3">
                {nextStatuses.length > 0 ? (
                  nextStatuses.map((status) => (
                    <form key={status} action={updateSellerOrderStatusAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="status" value={status} />
                      <button
                        type="submit"
                        className="w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Mark as {status.toLowerCase().replaceAll("_", " ")}
                      </button>
                    </form>
                  ))
                ) : (
                  <div className="rounded-[1.25rem] bg-white px-4 py-3 text-sm text-slate-500">
                    No seller action is available for the current status.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Order totals</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <span>Items subtotal</span>
                  <span>{formatPrice(order.totals.itemsSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Shipping fee</span>
                  <span>{formatPrice(order.totals.shippingFee)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Discount total</span>
                  <span>-{formatPrice(order.totals.discountTotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 text-base font-bold text-slate-950">
                  <span>Grand total</span>
                  <span>{formatPrice(order.totals.grandTotal)}</span>
                </div>
              </div>
              {order.appliedVoucherCodes.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {order.appliedVoucherCodes.map((code) => (
                    <div
                      key={code}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-orange-600"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
