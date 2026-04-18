import type { Route } from "next";
import Link from "next/link";
import { AdminPagination } from "@/components/admin/adminPagination";
import { EmptyState } from "@/components/storefront/emptyState";
import { normalizeAdminParams } from "@/lib/admin";
import { getAuditLogsPage } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function readShippingFields(
  value: unknown
): Array<{
  key: string;
  label: string;
  previousValue: string | null;
  nextValue: string | null;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const field = item as Record<string, unknown>;
    if (typeof field.key !== "string" || typeof field.label !== "string") {
      return [];
    }

    return [
      {
        key: field.key,
        label: field.label,
        previousValue:
          field.previousValue === null || typeof field.previousValue === "string"
            ? field.previousValue
            : String(field.previousValue ?? ""),
        nextValue:
          field.nextValue === null || typeof field.nextValue === "string"
            ? field.nextValue
            : String(field.nextValue ?? "")
      }
    ];
  });
}

export default async function AdminAuditPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeAdminParams(resolvedParams);
  const auditPage = await getAuditLogsPage({
    search: params.search,
    action: params.action,
    entityType: params.entityType,
    actorRole: params.actorRole,
    page: Number(params.page ?? "1"),
    pageSize: 20
  });

  if (!session || session.role !== "SUPER_ADMIN") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Super Admin access required"
          description="Open a Super Admin demo session to inspect the audit trail."
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
              Super Admin
            </p>
            <h1 className="text-3xl font-black text-slate-950">Audit log</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Search and filter high-privilege actions across moderation, governance, and runtime configuration.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={"/admin/settings" as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              System settings
            </Link>
            <Link
              href={"/admin" as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <form action="/admin/audit" className="mt-8 grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Summary, entity id, actor..."
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          />
          <input
            name="action"
            defaultValue={params.action}
            placeholder="Action contains..."
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          />
          <input
            name="entityType"
            defaultValue={params.entityType}
            placeholder="Entity type..."
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          />
          <select
            name="actorRole"
            defaultValue={params.actorRole ?? ""}
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          >
            <option value="">All actor roles</option>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 md:col-span-4"
          >
            Apply filters
          </button>
        </form>

        <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-950">Recent events</h2>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {auditPage.pagination.total} total
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {auditPage.items.length > 0 ? (
              auditPage.items.map((item) => (
                <div key={item.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-950">{item.summary}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {item.actorUser?.fullName ?? item.actorRole} • {item.action} • {item.entityType}
                        {item.entityId ? ` • ${item.entityId}` : ""}
                      </div>
                      {typeof item.metadata?.requestId === "string" ? (
                        <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Request {item.metadata.requestId}
                        </div>
                      ) : null}
                      {item.action === "orders.customer.update_shipping" ? (
                        <div className="mt-3 rounded-[1.25rem] bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Shipping change
                          </div>
                          <div className="mt-3 space-y-3">
                            {readShippingFields(item.metadata?.changedFields).map((field) => (
                              <div key={field.key} className="rounded-[1rem] bg-slate-50 px-3 py-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  {field.label}
                                </div>
                                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                                  <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                      Before
                                    </div>
                                    <div className="mt-1 text-slate-500">
                                      {field.previousValue || "Empty"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                      After
                                    </div>
                                    <div className="mt-1 font-semibold text-slate-950">
                                      {field.nextValue || "Empty"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {item.metadata ? (
                        <pre className="mt-3 overflow-x-auto rounded-[1rem] bg-white px-3 py-3 text-xs text-slate-600">
                          {JSON.stringify(item.metadata, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No audit events match this query"
                description="Try a broader search or clear one of the active filters."
              />
            )}
          </div>

          <div className="mt-6">
            <AdminPagination
              basePath="/admin/audit"
              page={auditPage.pagination.page}
              totalPages={auditPage.pagination.totalPages}
              currentParams={params}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
