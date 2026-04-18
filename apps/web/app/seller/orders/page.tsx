import type { Route } from "next";
import Link from "next/link";
import { updateSellerOrderStatusAction } from "@/app/actions/seller";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { getSellerOrders } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const sellerTransitions: Record<string, string[]> = {
  PENDING: ["CONFIRMED"],
  CONFIRMED: ["PROCESSING"],
  PROCESSING: ["SHIPPING"],
  SHIPPING: ["DELIVERED", "DELIVERY_FAILED"],
  RETURN_REQUESTED: ["RETURNED"]
};

export default async function SellerOrdersPage() {
  const session = await getDemoSession();
  const orders = await getSellerOrders();

  if (!session || session.role !== "SELLER") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as seller demo to inspect incoming orders"
          description="Use the Seller demo login in the top navigation, then open Seller Center orders."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Seller Center
            </p>
            <h1 className="text-3xl font-black text-slate-950">Incoming orders</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Track payment readiness, buyer details, and advance fulfillment from the seller side.
            </p>
          </div>
          <Link
            href={"/seller" as Route}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Back to products
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {orders.length > 0 ? (
            orders.map((order) => {
              const nextStatuses = sellerTransitions[order.status] ?? [];
              const latestPayment = order.payments[0] ?? null;

              return (
                <section
                  key={order.id}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
                        {order.orderNumber}
                      </p>
                      <h2 className="text-2xl font-black text-slate-950">{order.customer.fullName}</h2>
                      <p className="text-sm text-slate-500">
                        {order.customer.email} • {order.status} • {new Date(order.placedAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="text-left xl:text-right">
                      <p className="text-sm text-slate-500">Grand total</p>
                      <p className="text-2xl font-black text-slate-950">
                        {formatPrice(order.grandTotal)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-[1.5rem] border border-slate-100 bg-slate-50 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-950">{item.productName}</p>
                              <p className="text-sm text-slate-500">
                                {item.variantName ?? "Default"} • Qty {item.quantity}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-orange-600">
                              {formatPrice(item.subtotal)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <aside className="space-y-4 rounded-[1.75rem] border border-orange-100 bg-orange-50 p-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
                          Payment
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          {order.paymentMethod}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {latestPayment
                            ? `${latestPayment.status} • ${latestPayment.referenceCode}`
                            : "No payment record"}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
                          Fulfillment
                        </p>
                        <Link
                          href={`/seller/orders/${order.id}` as Route}
                          className="block rounded-full border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                        >
                          Open detail
                        </Link>
                        {order.status === "RETURN_REQUESTED" ? (
                          <p className="rounded-[1.2rem] bg-white px-3 py-2 text-sm text-amber-700">
                            Buyer submitted a return request. Inspect the case, then mark the package as returned once received.
                          </p>
                        ) : null}
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
                          <p className="text-sm text-slate-500">
                            No seller action is available for this status.
                          </p>
                        )}
                      </div>
                    </aside>
                  </div>
                </section>
              );
            })
          ) : (
            <EmptyState
              title="No seller orders yet"
              description="Once a buyer places a checkout order for this shop, it will appear here."
            />
          )}
        </div>
      </div>
    </main>
  );
}
