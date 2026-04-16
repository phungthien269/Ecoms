import { cancelOrderAction, completeOrderAction, confirmPaymentAction } from "@/app/actions/commerce";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { getOrder } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getDemoSession();
  const { orderId } = await params;
  const order = await getOrder(orderId);

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login to inspect this order"
          description="Use the buyer demo login first, then reopen this page."
        />
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Order not found"
          description="The requested order could not be loaded from the API."
        />
      </main>
    );
  }

  const latestPendingPayment = order.payments.find((payment) => payment.status === "PENDING");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Order detail
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">{order.orderNumber}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {order.status} • {order.paymentMethod} • {new Date(order.placedAt).toLocaleString("vi-VN")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {latestPendingPayment ? (
              <form action={confirmPaymentAction}>
                <input type="hidden" name="paymentId" value={latestPendingPayment.id} />
                <input type="hidden" name="orderId" value={order.id} />
                <button
                  type="submit"
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Confirm payment
                </button>
              </form>
            ) : null}

            {["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status) ? (
              <form action={cancelOrderAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <button
                  type="submit"
                  className="rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Cancel order
                </button>
              </form>
            ) : null}

            {order.status === "DELIVERED" ? (
              <form action={completeOrderAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <button
                  type="submit"
                  className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Mark completed
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Items</h2>
              <div className="mt-4 space-y-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[1.5rem] border border-slate-100 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-base font-semibold text-slate-950">{item.productName}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {item.variantName ? `${item.variantName} • ${item.variantSku}` : item.productSku}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-500">Qty {item.quantity}</div>
                        <div className="text-lg font-bold text-slate-950">
                          {formatPrice(item.subtotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Shipping</h2>
              <div className="mt-4 text-sm leading-7 text-slate-600">
                <div>{order.shippingAddress.recipientName}</div>
                <div>{order.shippingAddress.phoneNumber}</div>
                <div>{order.shippingAddress.addressLine1}</div>
                {order.shippingAddress.addressLine2 ? <div>{order.shippingAddress.addressLine2}</div> : null}
                <div>
                  {[order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.province]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Totals</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex justify-between gap-4">
                  <span>Items subtotal</span>
                  <span>{formatPrice(order.totals.itemsSubtotal)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Shipping fee</span>
                  <span>{formatPrice(order.totals.shippingFee)}</span>
                </div>
                <div className="flex justify-between gap-4 font-semibold text-slate-950">
                  <span>Grand total</span>
                  <span>{formatPrice(order.totals.grandTotal)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6">
              <h2 className="text-xl font-bold text-slate-950">Payments</h2>
              <div className="mt-4 space-y-3">
                {order.payments.map((payment) => (
                  <div key={payment.id} className="rounded-[1.5rem] bg-white p-4 text-sm text-slate-600">
                    <div className="font-semibold text-slate-950">
                      {payment.method} • {payment.status}
                    </div>
                    <div className="mt-1">{formatPrice(payment.amount)}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                      {payment.referenceCode}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
