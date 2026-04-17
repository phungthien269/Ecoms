import {
  cancelOrderAction,
  completeOrderAction,
  confirmPaymentAction,
  createReviewAction
} from "@/app/actions/commerce";
import { formatPrice } from "@/components/commerce/price";
import { UploadAssetField } from "@/components/media/uploadAssetField";
import { EmptyState } from "@/components/storefront/emptyState";
import { getOrder } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const timeline = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPING", "DELIVERED", "COMPLETED"];

export default async function OrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const { orderId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
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
  const activeTimelineIndex = timeline.indexOf(order.status);
  const flashMessage = getOrderFlashMessage(resolvedSearchParams);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {flashMessage ? (
          <div className="mb-6 rounded-[1.5rem] border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-slate-700">
            {flashMessage}
          </div>
        ) : null}

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
              <h2 className="text-xl font-bold text-slate-950">Lifecycle</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {timeline.map((status, index) => {
                  const isActive = order.status === status;
                  const isReached =
                    activeTimelineIndex >= 0
                      ? index <= activeTimelineIndex
                      : ["CANCELLED", "DELIVERY_FAILED", "RETURN_REQUESTED", "RETURNED", "REFUNDED"].includes(
                          order.status
                        ) && index === 0;

                  return (
                    <div
                      key={status}
                      className={`rounded-[1.5rem] border px-4 py-3 text-sm ${
                        isActive
                          ? "border-orange-300 bg-orange-50 text-orange-700"
                          : isReached
                            ? "border-slate-200 bg-slate-50 text-slate-700"
                            : "border-slate-100 bg-white text-slate-400"
                      }`}
                    >
                      <div className="font-semibold">{status.replaceAll("_", " ")}</div>
                    </div>
                  );
                })}
              </div>
              {["CANCELLED", "DELIVERY_FAILED", "RETURN_REQUESTED", "RETURNED", "REFUNDED"].includes(order.status) ? (
                <div className="mt-4 rounded-[1.5rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  This order left the normal completion track with status <span className="font-semibold text-slate-950">{order.status}</span>.
                </div>
              ) : null}
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Items</h2>
              <div className="mt-4 space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="rounded-[1.5rem] border border-slate-100 p-4">
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
                    {order.status === "COMPLETED" && !item.reviewId ? (
                      <div className="mt-4 rounded-[1.25rem] bg-slate-50 p-4">
                        <form action={createReviewAction}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="orderItemId" value={item.id} />
                          <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto]">
                            <select
                              name="rating"
                              defaultValue="5"
                              className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
                            >
                              <option value="5">5 stars</option>
                              <option value="4">4 stars</option>
                              <option value="3">3 stars</option>
                              <option value="2">2 stars</option>
                              <option value="1">1 star</option>
                            </select>
                            <input
                              name="comment"
                              placeholder="Share your feedback for this product"
                              className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
                            />
                            <button
                              type="submit"
                              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                              Review
                            </button>
                          </div>
                          <div className="mt-4">
                            <UploadAssetField
                              accessToken={session.accessToken}
                              folder="reviews"
                              assetIdInputName="imageFileAssetId"
                              label="Review image"
                              helperText="Upload ảnh review thật. Submit form sau khi asset READY."
                            />
                          </div>
                        </form>
                      </div>
                    ) : null}
                    {item.reviewId ? (
                      <div className="mt-4 rounded-[1.25rem] bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                        Review submitted for this item.
                      </div>
                    ) : null}
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
                <div className="flex justify-between gap-4">
                  <span>Voucher discount</span>
                  <span>-{formatPrice(order.totals.discountTotal)}</span>
                </div>
                <div className="flex justify-between gap-4 font-semibold text-slate-950">
                  <span>Grand total</span>
                  <span>{formatPrice(order.totals.grandTotal)}</span>
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
                    {payment.expiresAt ? (
                      <div className="mt-2 text-xs text-slate-500">
                        Expires {new Date(payment.expiresAt).toLocaleString("vi-VN")}
                      </div>
                    ) : null}
                    {payment.paidAt ? (
                      <div className="mt-2 text-xs text-emerald-600">
                        Confirmed {new Date(payment.paidAt).toLocaleString("vi-VN")}
                      </div>
                    ) : null}
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

function getOrderFlashMessage(searchParams: Record<string, string | string[] | undefined>) {
  const placed = readSearchParam(searchParams.placed);
  const payment = readSearchParam(searchParams.payment);
  const status = readSearchParam(searchParams.status);

  if (placed === "1") {
    return "Order placed successfully. If you selected an online payment method, confirm the pending payment below to move the order forward.";
  }

  if (payment === "confirmed") {
    return "Payment confirmed. The order status has been refreshed and is ready for seller processing.";
  }

  if (status === "cancelled") {
    return "Order cancelled before shipping.";
  }

  if (status === "completed") {
    return "Order marked as completed.";
  }

  return null;
}

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
