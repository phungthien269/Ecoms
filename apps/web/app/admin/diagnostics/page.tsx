import type { Route } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/storefront/emptyState";
import { getSystemDiagnostics } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminDiagnosticsPage() {
  const session = await getDemoSession();
  const diagnostics = await getSystemDiagnostics();

  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Admin access required"
          description="Open an Admin or Super Admin demo session to inspect diagnostics."
        />
      </main>
    );
  }

  if (!diagnostics) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Diagnostics unavailable"
          description="The diagnostics API did not return a payload right now."
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
              Operations
            </p>
            <h1 className="text-3xl font-black text-slate-950">Runtime diagnostics</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Inspect dependency readiness, fallback stores, and provider probe results from one page.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={"/admin" as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm text-slate-500">
                Updated {new Date(diagnostics.timestamp).toLocaleString("vi-VN")}
              </div>
              <div className="mt-2 text-lg font-bold text-slate-950">{diagnostics.service}</div>
            </div>
            <div
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold",
                diagnostics.status === "ok"
                  ? "bg-emerald-50 text-emerald-700"
                  : diagnostics.status === "degraded"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-700"
              ].join(" ")}
            >
              {diagnostics.status.toUpperCase()} • {diagnostics.ready ? "READY" : "NOT READY"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {diagnostics.checks.map((check) => (
              <div key={check.key} className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-950">{check.label}</div>
                    <div className="mt-1 text-sm text-slate-600">{check.message}</div>
                  </div>
                  <div
                    className={[
                      "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                      check.status === "ok"
                        ? "bg-emerald-100 text-emerald-700"
                        : check.status === "degraded"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    ].join(" ")}
                  >
                    {check.status}
                  </div>
                </div>
                {check.details ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {Object.entries(check.details).map(([key, value]) => (
                      <div key={key} className="rounded-[1rem] bg-white px-3 py-3 text-xs text-slate-600">
                        <div className="font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {key}
                        </div>
                        <div className="mt-1 break-all text-slate-700">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
