import type { Route } from "next";
import Link from "next/link";
import { batchReplayProviderWebhookAction } from "@/app/actions/admin";
import { AdminFlashBanner } from "@/components/admin/adminFlashBanner";
import { AdminPagination } from "@/components/admin/adminPagination";
import { EmptyState } from "@/components/storefront/emptyState";
import { buildAdminHref, clearAdminFlash, normalizeAdminParams } from "@/lib/admin";
import { getAdminPaymentProviderEventsPage } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function getProviderMode(source: string, payload: Record<string, unknown> | null) {
  const providerMode =
    typeof payload?.providerMode === "string"
      ? payload.providerMode
      : source === "demo_gateway_webhook"
        ? "demo_gateway"
        : "mock_gateway";

  return providerMode;
}

function getProviderReference(payload: Record<string, unknown> | null) {
  return typeof payload?.providerReference === "string" ? payload.providerReference : null;
}

export default async function AdminProviderEventsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeAdminParams(resolvedParams);
  const page = Number(params.page ?? "1");
  const providerEventsPage = await getAdminPaymentProviderEventsPage({
    search: params.search,
    eventType: params.eventType,
    providerMode: params.providerMode,
    callbackOutcome: params.callbackOutcome,
    page,
    pageSize: 12
  });

  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Admin access required"
          description="Open an Admin or Super Admin demo session to inspect provider callback history."
        />
      </main>
    );
  }

  const cleanParams = clearAdminFlash(params);
  const visiblePaymentIds = providerEventsPage.items.map((event) => event.payment.id).join(",");
  const visibleReferenceCodes = providerEventsPage.items
    .map((event) => event.payment.referenceCode)
    .join(",");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Payment operations
            </p>
            <h1 className="text-3xl font-black text-slate-950">Provider callback history</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Review processed and ignored provider callbacks across mock and demo gateway flows, then jump into the affected payment trace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={"/admin/payments" as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Back to payments
            </Link>
          </div>
        </div>

        <form
          action="/admin/payments/provider-events"
          className="mt-8 grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4"
        >
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Payment, order, buyer..."
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          />
          <select
            name="providerMode"
            defaultValue={params.providerMode ?? ""}
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          >
            <option value="">All providers</option>
            <option value="mock_gateway">mock_gateway</option>
            <option value="demo_gateway">demo_gateway</option>
          </select>
          <select
            name="callbackOutcome"
            defaultValue={params.callbackOutcome ?? ""}
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          >
            <option value="">All outcomes</option>
            <option value="processed">processed</option>
            <option value="ignored">ignored</option>
          </select>
          <input
            name="eventType"
            defaultValue={params.eventType}
            placeholder="Event type, e.g. CALLBACK"
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

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <MetricCard label="Processed callbacks" value={String(providerEventsPage.summary.processedCount)} />
          <MetricCard label="Ignored callbacks" value={String(providerEventsPage.summary.ignoredCount)} />
          <MetricCard label="mock_gateway events" value={String(providerEventsPage.summary.mockGatewayCount)} />
          <MetricCard label="demo_gateway events" value={String(providerEventsPage.summary.demoGatewayCount)} />
        </section>

        {providerEventsPage.items.length > 0 ? (
          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Recovery actions</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Replay the currently visible callback set through the active provider contract. This uses the same provider-aware replay path as payment diagnostics, not the mock-only batch route.
                </p>
              </div>
              <div className="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Visible targets: {providerEventsPage.items.length}
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {["PAID", "FAILED", "EXPIRED"].map((event) => (
                <form key={event} action={batchReplayProviderWebhookAction} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <input type="hidden" name="redirectTo" value={buildAdminHref("/admin/payments/provider-events", cleanParams)} />
                  <input type="hidden" name="paymentIds" value={visiblePaymentIds} />
                  <input type="hidden" name="referenceCodes" value={visibleReferenceCodes} />
                  <input type="hidden" name="event" value={event} />
                  <input
                    type="hidden"
                    name="providerReferencePrefix"
                    value={`provider-events-${event.toLowerCase()}`}
                  />
                  <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Batch replay
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-950">{event}</div>
                  <p className="mt-2 text-sm text-slate-500">
                    Applies {event} to the visible callback set through the active provider mode.
                  </p>
                  <button
                    type="submit"
                    className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Replay visible set
                  </button>
                </form>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Callback backlog</h2>
              <p className="mt-1 text-sm text-slate-500">
                {providerEventsPage.pagination.total} callback event(s) matched the current filters.
              </p>
            </div>
            <Link
              href={buildAdminHref("/admin/payments", cleanParams) as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Open payment incidents
            </Link>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  <th className="pb-3 pr-4">Event</th>
                  <th className="pb-3 pr-4">Payment</th>
                  <th className="pb-3 pr-4">Buyer / Shop</th>
                  <th className="pb-3 pr-4">Provider ref</th>
                  <th className="pb-3 pr-4">Created</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {providerEventsPage.items.map((event) => {
                  const providerMode = getProviderMode(event.source, event.payload);
                  const providerReference = getProviderReference(event.payload);
                  const isProcessed = event.eventType === "PAYMENT_CALLBACK_PROCESSED";

                  return (
                    <tr key={event.id} className="align-top">
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-slate-950">{event.eventType}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                              isProcessed
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {isProcessed ? "processed" : "ignored"}
                          </span>
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                            {providerMode}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {event.actorUser
                            ? `${event.actorUser.fullName} • ${event.actorType}`
                            : `${event.actorType} • ${event.source}`}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-slate-950">{event.payment.referenceCode}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {event.previousStatus ? `${event.previousStatus} -> ` : ""}
                          {event.nextStatus} • {event.payment.method}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{event.order.orderNumber}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-slate-950">{event.user.fullName}</div>
                        <div className="mt-1 text-xs text-slate-500">{event.user.email}</div>
                        <div className="mt-2 text-xs text-slate-500">{event.order.shop.name}</div>
                      </td>
                      <td className="py-4 pr-4 text-xs text-slate-500">
                        {providerReference ?? "No provider reference"}
                      </td>
                      <td className="py-4 pr-4 text-xs text-slate-500">
                        {new Date(event.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-4 text-right">
                        <Link
                          href={`/admin/payments/${event.payment.id}` as Route}
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                        >
                          Open trace
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {providerEventsPage.items.length === 0 ? (
            <div className="mt-6 rounded-[1.5rem] bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No provider callback events matched the current filters.
            </div>
          ) : null}

          <div className="mt-8">
            <AdminPagination
              basePath="/admin/payments/provider-events"
              page={providerEventsPage.pagination.page}
              totalPages={providerEventsPage.pagination.totalPages}
              currentParams={cleanParams}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-3 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}
