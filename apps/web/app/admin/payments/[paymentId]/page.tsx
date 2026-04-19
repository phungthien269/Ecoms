import type { Route } from "next";
import Link from "next/link";
import {
  replayPaymentGatewayWebhookAction,
  updateSystemSettingAction
} from "@/app/actions/admin";
import { AdminFlashBanner } from "@/components/admin/adminFlashBanner";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { normalizeAdminParams } from "@/lib/admin";
import { getAdminPaymentTrace } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPaymentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ paymentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const { paymentId } = await params;
  const resolvedParams = searchParams ? await searchParams : {};
  const adminParams = normalizeAdminParams(resolvedParams);
  const paymentTrace = await getAdminPaymentTrace({ paymentId });

  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Admin access required"
          description="Open an Admin or Super Admin demo session to inspect payment traces."
        />
      </main>
    );
  }

  if (!paymentTrace) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Payment trace not found"
          description="The payment ID could not be resolved. Return to the payment backlog and select a different payment."
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
              Payment trace
            </p>
            <h1 className="text-3xl font-black text-slate-950">
              {paymentTrace.payment.referenceCode}
            </h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Deep inspection surface for a single payment, including buyer, shop, order link, payment metadata, and replay actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={"/admin/payments" as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Back to payments
            </Link>
            <Link
              href={`/orders/${paymentTrace.payment.orderId}` as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Open buyer order
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <AdminFlashBanner
            scope={adminParams.adminScope}
            status={adminParams.adminStatus}
            message={adminParams.adminMessage}
          />
        </div>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <DetailCard label="Status" value={`${paymentTrace.payment.status} • ${paymentTrace.payment.method}`} />
              <DetailCard label="Amount" value={formatPrice(paymentTrace.payment.amount)} />
              <DetailCard label="Buyer" value={`${paymentTrace.payment.user.fullName} • ${paymentTrace.payment.user.email}`} />
              <DetailCard label="Shop" value={`${paymentTrace.payment.shop.name} • ${paymentTrace.payment.orderNumber}`} />
              <DetailCard
                label="Created"
                value={new Date(paymentTrace.payment.createdAt).toLocaleString("vi-VN")}
              />
              <DetailCard
                label="Expires"
                value={
                  paymentTrace.payment.expiresAt
                    ? new Date(paymentTrace.payment.expiresAt).toLocaleString("vi-VN")
                    : "No expiry"
                }
              />
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Gateway control
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Pause or resume new online-gateway checkouts from this payment view when an incident is in progress.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={updateSystemSettingAction}>
                    <input type="hidden" name="redirectTo" value={`/admin/payments/${paymentId}`} />
                    <input type="hidden" name="key" value="payment_online_gateway_enabled" />
                    <input
                      type="hidden"
                      name="value"
                      value={paymentTrace.payment.method === "ONLINE_GATEWAY" ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
                    >
                      Pause gateway
                    </button>
                  </form>
                  <Link
                    href={"/admin/settings" as Route}
                    className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                  >
                    Open settings
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Replay callback
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Trigger a real mock callback against this payment without re-entering the payment ID.
                </p>
                <form action={replayPaymentGatewayWebhookAction} className="mt-4 grid gap-3">
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={`/admin/payments/${paymentId}`}
                  />
                  <input type="hidden" name="paymentId" value={paymentId} />
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Event
                    <select
                      name="event"
                      defaultValue="PAID"
                      className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
                    >
                      <option value="PAID">PAID</option>
                      <option value="FAILED">FAILED</option>
                      <option value="EXPIRED">EXPIRED</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Provider reference
                    <input
                      name="providerReference"
                      placeholder="gateway_ref_123"
                      className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Replay callback
                  </button>
                </form>
              </div>
            </div>
          </div>

          <details className="mt-6 rounded-[1.5rem] bg-slate-50 p-5">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Payment metadata
            </summary>
            <pre className="mt-4 overflow-x-auto text-xs text-slate-700">
              {JSON.stringify(paymentTrace.payment.metadata, null, 2)}
            </pre>
          </details>
        </section>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-950">Payment event timeline</h2>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {paymentTrace.events.length} event(s)
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {paymentTrace.events.map((event) => (
              <div key={event.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {event.eventType}
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {event.previousStatus ? `${event.previousStatus} -> ` : ""}
                      {event.nextStatus}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {event.actorUser
                        ? `${event.actorUser.fullName} • ${event.actorType}`
                        : `${event.actorType} • ${event.source}`}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(event.createdAt).toLocaleString("vi-VN")}
                  </div>
                </div>
                {event.payload ? (
                  <details className="mt-4 rounded-[1rem] bg-white p-4">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Event payload
                    </summary>
                    <pre className="mt-3 overflow-x-auto text-xs text-slate-700">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] bg-slate-50 p-5">
      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}
