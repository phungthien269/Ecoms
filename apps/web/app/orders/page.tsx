import type { Route } from "next";
import Link from "next/link";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { getOrders } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getDemoSession();
  const orders = await getOrders();

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login to inspect orders"
          description="Use the buyer demo login in the top navigation to see placed orders."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
            Orders
          </p>
          <h1 className="text-3xl font-black text-slate-950">Buyer order history</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Review order totals, payment state, and jump into detailed lifecycle actions.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {orders.length > 0 ? (
            orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}` as Route}
                className="block rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
                      {order.orderNumber}
                    </p>
                    <h2 className="text-xl font-bold text-slate-950">{order.shop.name}</h2>
                    <p className="text-sm text-slate-500">
                      {order.status} • {order.paymentMethod} • {new Date(order.placedAt).toLocaleString("vi-VN")}
                    </p>
                    {order.payments.some((payment) => payment.status === "PENDING") ? (
                      <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Pending payment action
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Grand total</p>
                    <p className="text-2xl font-black text-slate-950">
                      {formatPrice(order.grandTotal)}
                    </p>
                  </div>
                </div>
                {order.appliedVoucherCodes.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.appliedVoucherCodes.map((code) => (
                      <div
                        key={`${order.id}-${code}`}
                        className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))
          ) : (
            <EmptyState
              title="No orders yet"
              description="Place a demo order from checkout and it will appear here."
            />
          )}
        </div>
      </div>
    </main>
  );
}
