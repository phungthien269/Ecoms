import type { Route } from "next";
import Link from "next/link";
import { AdminFlashBanner } from "@/components/admin/adminFlashBanner";
import { AdminPagination } from "@/components/admin/adminPagination";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { buildAdminHref, clearAdminFlash, normalizeAdminParams } from "@/lib/admin";
import { getAdminPaymentsPage } from "@/lib/commerceApi";
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
  const paymentsPage = await getAdminPaymentsPage({
    search: params.search,
    status: params.status,
    paymentMethod: params.paymentMethod,
    eventType: params.eventType,
    page: Number(params.page ?? "1"),
    pageSize: 12
  });

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
  const traceBaseParams = {
    ...cleanParams,
    page: undefined
  };

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
              Search gateway references, filter by status or event type, and jump straight into payment trace diagnostics.
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
                        href={buildAdminHref("/admin/diagnostics", {
                          ...traceBaseParams,
                          traceReferenceCode: payment.referenceCode
                        }) as Route}
                        className="mt-3 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                      >
                        Open trace
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
