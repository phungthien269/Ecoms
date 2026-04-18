import type { Route } from "next";
import Link from "next/link";
import { updateAdminReportStatusAction } from "@/app/actions/admin";
import { AdminPagination } from "@/components/admin/adminPagination";
import { EmptyState } from "@/components/storefront/emptyState";
import { buildAdminHref, normalizeAdminParams } from "@/lib/admin";
import { getAdminReportsPage } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeAdminParams(resolvedParams);
  const reportsPage = await getAdminReportsPage({
    search: params.search,
    status: params.status,
    targetType: params.targetType,
    page: Number(params.page ?? "1"),
    pageSize: 12
  });

  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as admin demo to inspect moderation reports"
          description="Use the Admin or Super Admin demo session, then reopen this page."
        />
      </main>
    );
  }

  const redirectTo = buildAdminHref("/admin/reports", params);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Admin backlog
            </p>
            <h1 className="text-3xl font-black text-slate-950">Moderation reports</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Triage product, shop, and review reports with filters and direct moderation actions.
            </p>
          </div>
          <Link
            href={"/admin" as Route}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Back to dashboard
          </Link>
        </div>

        <form action="/admin/reports" className="mt-8 grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Reason, reporter, product, shop..."
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          />
          <select name="status" defaultValue={params.status ?? ""} className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <option value="">All statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>
          <select name="targetType" defaultValue={params.targetType ?? ""} className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <option value="">All target types</option>
            <option value="PRODUCT">PRODUCT</option>
            <option value="SHOP">SHOP</option>
            <option value="REVIEW">REVIEW</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Apply filters
          </button>
        </form>

        <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-950">Report queue</h2>
            <div className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {reportsPage.pagination.total} total
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {reportsPage.items.length > 0 ? (
              reportsPage.items.map((report) => (
                <div key={report.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-950">
                        {report.targetType} report • {report.reason}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {report.reporter.fullName} • {report.status} • {new Date(report.createdAt).toLocaleDateString("vi-VN")}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        {report.details ?? "No additional detail provided."}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Target:{" "}
                        {"name" in (report.target ?? {}) && report.target?.name
                          ? report.target.name
                          : "comment" in (report.target ?? {}) && report.target?.product
                            ? `${report.target.product.name} review`
                            : report.targetId}
                      </div>
                      {"status" in (report.target ?? {}) && report.target?.status ? (
                        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Current target status: {report.target.status}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["IN_REVIEW", "RESOLVED", "DISMISSED"].map((status) => (
                        <form key={status} action={updateAdminReportStatusAction}>
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <input type="hidden" name="reportId" value={report.id} />
                          <input type="hidden" name="status" value={status} />
                          <input type="hidden" name="resolvedNote" value={`Admin set ${status.toLowerCase().replaceAll("_", " ")}`} />
                          <button
                            type="submit"
                            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                          >
                            Set {status.toLowerCase().replaceAll("_", " ")}
                          </button>
                        </form>
                      ))}
                      {report.targetType === "PRODUCT" ? (
                        <>
                          <form action={updateAdminReportStatusAction}>
                            <input type="hidden" name="redirectTo" value={redirectTo} />
                            <input type="hidden" name="reportId" value={report.id} />
                            <input type="hidden" name="status" value="RESOLVED" />
                            <input type="hidden" name="moderationAction" value="BAN_PRODUCT" />
                            <input type="hidden" name="resolvedNote" value="Admin banned the reported product" />
                            <button
                              type="submit"
                              className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300"
                            >
                              Ban product + resolve
                            </button>
                          </form>
                          <form action={updateAdminReportStatusAction}>
                            <input type="hidden" name="redirectTo" value={redirectTo} />
                            <input type="hidden" name="reportId" value={report.id} />
                            <input type="hidden" name="status" value="RESOLVED" />
                            <input type="hidden" name="moderationAction" value="ACTIVATE_PRODUCT" />
                            <input type="hidden" name="resolvedNote" value="Admin restored the reported product" />
                            <button
                              type="submit"
                              className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:border-emerald-300"
                            >
                              Restore product + resolve
                            </button>
                          </form>
                        </>
                      ) : null}
                      {report.targetType === "SHOP" ? (
                        <>
                          <form action={updateAdminReportStatusAction}>
                            <input type="hidden" name="redirectTo" value={redirectTo} />
                            <input type="hidden" name="reportId" value={report.id} />
                            <input type="hidden" name="status" value="RESOLVED" />
                            <input type="hidden" name="moderationAction" value="SUSPEND_SHOP" />
                            <input type="hidden" name="resolvedNote" value="Admin suspended the reported shop" />
                            <button
                              type="submit"
                              className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300"
                            >
                              Suspend shop + resolve
                            </button>
                          </form>
                          <form action={updateAdminReportStatusAction}>
                            <input type="hidden" name="redirectTo" value={redirectTo} />
                            <input type="hidden" name="reportId" value={report.id} />
                            <input type="hidden" name="status" value="RESOLVED" />
                            <input type="hidden" name="moderationAction" value="ACTIVATE_SHOP" />
                            <input type="hidden" name="resolvedNote" value="Admin restored the reported shop" />
                            <button
                              type="submit"
                              className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:border-emerald-300"
                            >
                              Restore shop + resolve
                            </button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No reports match this query"
                description="Try a broader search or clear one of the active moderation filters."
              />
            )}
          </div>

          <div className="mt-6">
            <AdminPagination
              basePath="/admin/reports"
              page={reportsPage.pagination.page}
              totalPages={reportsPage.pagination.totalPages}
              currentParams={params}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
