import type { Route } from "next";
import Link from "next/link";
import { updateSystemSettingAction } from "@/app/actions/admin";
import { AdminFlashBanner } from "@/components/admin/adminFlashBanner";
import { AdminPagination } from "@/components/admin/adminPagination";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { buildAdminHref, clearAdminFlash, normalizeAdminParams } from "@/lib/admin";
import { getAdminPaymentIncidentCenter, getAdminPaymentsPage } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeAdminParams(resolvedParams);
  const [paymentsPage, incidentCenter] = await Promise.all([
    getAdminPaymentsPage({
      search: params.search,
      status: params.status,
      paymentMethod: params.paymentMethod,
      eventType: params.eventType,
      page: Number(params.page ?? "1"),
      pageSize: 12
    }),
    getAdminPaymentIncidentCenter()
  ]);

  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as admin demo to inspect payment backlog"
          description="Use the Admin or Super Admin demo session, then reopen this page."
        />
      </main>
    );
  }

  const cleanParams = clearAdminFlash(params);
  const incidentMessage = incidentCenter?.gateway.incidentMessage ?? "";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Admin backlog
            </p>
            <h1 className="text-3xl font-black text-slate-950">Payments</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Search gateway references, filter by status or event type, and open a dedicated payment investigation workspace for each payment.
            </p>
          </div>
          <Link
            href={"/admin" as Route}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Back to dashboard
          </Link>
        </div>

        <form action="/admin/payments" className="mt-8 grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Reference, order, buyer..."
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          />
          <select name="status" defaultValue={params.status ?? ""} className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <option value="">All statuses</option>
            {["PENDING", "PAID", "FAILED", "EXPIRED", "CANCELLED"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select name="paymentMethod" defaultValue={params.paymentMethod ?? ""} className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <option value="">All methods</option>
            <option value="COD">COD</option>
            <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            <option value="ONLINE_GATEWAY">ONLINE_GATEWAY</option>
          </select>
          <input
            name="eventType"
            defaultValue={params.eventType}
            placeholder="Event type, e.g. PAYMENT_PAID"
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          />
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 md:col-span-4"
          >
            Apply filters
          </button>
        </form>

        <div className="mt-6">
          <AdminFlashBanner
            scope={params.adminScope}
            status={params.adminStatus}
            message={params.adminMessage}
          />
        </div>

        {incidentCenter ? (
          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
                  Incident center
                </div>
                <h2 className="text-2xl font-black text-slate-950">
                  Online gateway {incidentCenter.gateway.enabled ? "live" : "paused"}
                </h2>
                <p className="max-w-2xl text-sm text-slate-500">
                  {incidentCenter.gateway.incidentMessage ??
                    "No public incident message is active. Operators can still inspect pending volume, replay callbacks, and trace payment state here."}
                </p>
                <div className="rounded-[1.5rem] border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                  {incidentCenter.gateway.displayName} • {incidentCenter.gateway.mode} •{" "}
                  {incidentCenter.gateway.configured ? "configured" : "not fully configured"}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <form action={updateSystemSettingAction}>
                  <input type="hidden" name="redirectTo" value="/admin/payments" />
                  <input type="hidden" name="key" value="payment_online_gateway_enabled" />
                  <input
                    type="hidden"
                    name="value"
                    value={incidentCenter.gateway.enabled ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className={`rounded-full px-5 py-3 text-sm font-semibold text-white transition ${
                      incidentCenter.gateway.enabled
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {incidentCenter.gateway.enabled ? "Pause gateway" : "Resume gateway"}
                  </button>
                </form>
                <Link
                  href={"/admin/settings" as Route}
                  className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                >
                  Open settings
                </Link>
                <Link
                  href={"/admin/diagnostics" as Route}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open diagnostics
                </Link>
              </div>
            </div>

            <form action={updateSystemSettingAction} className="mt-6 rounded-[1.5rem] bg-slate-50 p-5">
              <input type="hidden" name="redirectTo" value="/admin/payments" />
              <input type="hidden" name="key" value="payment_incident_message" />
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="grid flex-1 gap-2 text-sm font-medium text-slate-700">
                  Public incident message
                  <textarea
                    name="value"
                    defaultValue={incidentMessage}
                    rows={3}
                    placeholder="Optional storefront notice shown while the online gateway is paused."
                    className="rounded-[1.5rem] border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Save message
                </button>
              </div>
            </form>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <MetricCard label="Pending gateway payments" value={String(incidentCenter.impact.pendingCount)} />
              <MetricCard label="Recent failed/expired" value={String(incidentCenter.impact.recentFailedOrExpiredCount)} />
              <MetricCard
                label="Oldest pending"
                value={
                  incidentCenter.impact.oldestPendingAt
                    ? new Date(incidentCenter.impact.oldestPendingAt).toLocaleString("vi-VN")
                    : "None"
                }
              />
              <MetricCard
                label="Next expiry"
                value={
                  incidentCenter.impact.nextPendingExpiryAt
                    ? new Date(incidentCenter.impact.nextPendingExpiryAt).toLocaleString("vi-VN")
                    : "None"
                }
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Pending age buckets
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <MetricCard compact label="< 5 min" value={String(incidentCenter.impact.pendingAgeBuckets.underFiveMinutes)} />
                  <MetricCard compact label="5-15 min" value={String(incidentCenter.impact.pendingAgeBuckets.fiveToFifteenMinutes)} />
                  <MetricCard compact label="> 15 min" value={String(incidentCenter.impact.pendingAgeBuckets.overFifteenMinutes)} />
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Failure breakdown
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <MetricCard compact label="FAILED" value={String(incidentCenter.impact.recentFailureBreakdown.failed)} />
                  <MetricCard compact label="EXPIRED" value={String(incidentCenter.impact.recentFailureBreakdown.expired)} />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-950">Most impacted shops</h3>
                  <div className="text-sm text-slate-500">
                    {incidentCenter.impact.affectedShops.length} ranked
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {incidentCenter.impact.affectedShops.length > 0 ? (
                    incidentCenter.impact.affectedShops.map((shop) => (
                      <div key={shop.id} className="rounded-[1rem] bg-white px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-950">{shop.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {shop.totalImpactedPayments} impacted payment(s)
                            </div>
                          </div>
                          <Link
                            href={`/shops/${shop.slug}` as Route}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                          >
                            Shop
                          </Link>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Pending {shop.pendingCount}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Failed/Expired {shop.failedOrExpiredCount}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1rem] bg-white px-4 py-4 text-sm text-slate-500">
                      No shop-level payment impact right now.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-950">Most impacted buyers</h3>
                  <div className="text-sm text-slate-500">
                    {incidentCenter.impact.affectedCustomers.length} ranked
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {incidentCenter.impact.affectedCustomers.length > 0 ? (
                    incidentCenter.impact.affectedCustomers.map((customer) => (
                      <div key={customer.id} className="rounded-[1rem] bg-white px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-950">{customer.fullName}</div>
                            <div className="mt-1 text-xs text-slate-500">{customer.email}</div>
                          </div>
                          <Link
                            href={buildAdminHref("/admin/users", {
                              search: customer.email,
                              page: "1"
                            }) as Route}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                          >
                            User
                          </Link>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Pending {customer.pendingCount}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Failed/Expired {customer.failedOrExpiredCount}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Total {customer.totalImpactedPayments}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1rem] bg-white px-4 py-4 text-sm text-slate-500">
                      No buyer-level payment impact right now.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-950">Pending gateway queue</h3>
                  <Link
                    href={buildAdminHref("/admin/payments", {
                      ...cleanParams,
                      page: "1",
                      paymentMethod: "ONLINE_GATEWAY",
                      status: "PENDING"
                    }) as Route}
                    className="text-sm font-semibold text-orange-600"
                  >
                    View all
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {incidentCenter.pendingPayments.length > 0 ? (
                    incidentCenter.pendingPayments.map((payment) => (
                      <div key={payment.id} className="rounded-[1rem] bg-white px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-950">{payment.referenceCode}</div>
                            <div className="mt-1 text-sm text-slate-500">
                              {payment.user.fullName} • {payment.order.orderNumber} • {payment.order.shop.name}
                            </div>
                          </div>
                          <Link
                            href={`/admin/payments/${payment.id}` as Route}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                          >
                            Open
                          </Link>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>{formatPrice(payment.amount)}</span>
                          <span>
                            Expires{" "}
                            {payment.expiresAt
                              ? new Date(payment.expiresAt).toLocaleString("vi-VN")
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1rem] bg-white px-4 py-4 text-sm text-slate-500">
                      No pending online-gateway payments right now.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-950">Recent failures</h3>
                  <Link
                    href={buildAdminHref("/admin/payments", {
                      ...cleanParams,
                      page: "1",
                      paymentMethod: "ONLINE_GATEWAY",
                      status: "FAILED"
                    }) as Route}
                    className="text-sm font-semibold text-orange-600"
                  >
                    Failed queue
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {incidentCenter.recentFailures.length > 0 ? (
                    incidentCenter.recentFailures.map((payment) => (
                      <div key={payment.id} className="rounded-[1rem] bg-white px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-950">{payment.referenceCode}</div>
                            <div className="mt-1 text-sm text-slate-500">
                              {payment.user.fullName} • {payment.order.orderNumber}
                            </div>
                          </div>
                          <Link
                            href={`/admin/payments/${payment.id}` as Route}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                          >
                            Open
                          </Link>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>{payment.status}</span>
                          <span>{formatPrice(payment.amount)}</span>
                          <span>{new Date(payment.updatedAt).toLocaleString("vi-VN")}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1rem] bg-white px-4 py-4 text-sm text-slate-500">
                      No failed or expired gateway payments in the recent window.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-950">Incident activity</h3>
                  <div className="text-sm text-slate-500">{incidentCenter.activity.length} recent event(s)</div>
                </div>
                <div className="mt-4 space-y-3">
                  {incidentCenter.activity.length > 0 ? (
                    incidentCenter.activity.map((item) => (
                      <div key={item.id} className="rounded-[1rem] bg-white px-4 py-3">
                        <div className="font-semibold text-slate-950">{item.summary}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">
                          {item.actorUser?.fullName ?? item.actorRole} • {item.action}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {new Date(item.createdAt).toLocaleString("vi-VN")}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1rem] bg-white px-4 py-4 text-sm text-slate-500">
                      No incident-related payment activity has been recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-950">Payment backlog</h2>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {paymentsPage.pagination.total} total
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {paymentsPage.items.length > 0 ? (
              paymentsPage.items.map((payment) => (
                <div key={payment.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-950">{payment.referenceCode}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {payment.user.fullName} • {payment.order.orderNumber} • {payment.order.shop.name}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-600">
                          {payment.method}
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          {payment.status}
                        </div>
                      </div>
                    </div>
                    <div className="text-left lg:text-right">
                      <div className="text-sm font-semibold text-orange-600">{formatPrice(payment.amount)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(payment.createdAt).toLocaleString("vi-VN")}
                      </div>
                      <Link
                        href={`/admin/payments/${payment.id}` as Route}
                        className="mt-3 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                      >
                        Open payment
                      </Link>
                    </div>
                  </div>
                  {payment.recentEvents.length > 0 ? (
                    <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                      {payment.recentEvents.map((event) => (
                        <div key={event.id} className="rounded-[1rem] bg-white px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                {event.eventType}
                              </div>
                              <div className="mt-1 text-sm font-medium text-slate-950">
                                {event.previousStatus ? `${event.previousStatus} -> ` : ""}{event.nextStatus}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {event.actorUser
                                  ? `${event.actorUser.fullName} • ${event.actorType}`
                                  : `${event.actorType} • ${event.source}`}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(event.createdAt).toLocaleString("vi-VN")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState
                title="No payments match this query"
                description="Try a broader search or clear one of the active payment filters."
              />
            )}
          </div>

          <div className="mt-6">
            <AdminPagination
              basePath="/admin/payments"
              page={paymentsPage.pagination.page}
              totalPages={paymentsPage.pagination.totalPages}
              currentParams={cleanParams}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  compact = false
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[1.5rem] bg-slate-50 p-5">
      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className={`mt-3 font-black text-slate-950 ${compact ? "text-xl" : "text-2xl"}`}>
        {value}
      </div>
    </div>
  );
}
