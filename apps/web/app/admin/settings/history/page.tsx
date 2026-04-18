import type { Route } from "next";
import Link from "next/link";
import { AdminFlashBanner } from "@/components/admin/adminFlashBanner";
import { EmptyState } from "@/components/storefront/emptyState";
import { getSystemSettingHistory } from "@/lib/commerceApi";
import { normalizeAdminParams } from "@/lib/admin";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminSettingsHistoryPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeAdminParams(resolvedParams);
  const historyGroups = await getSystemSettingHistory();

  if (!session || session.role !== "SUPER_ADMIN") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Super Admin access required"
          description="Open a Super Admin demo session to inspect settings history."
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
            <h1 className="text-3xl font-black text-slate-950">Settings history</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Review runtime config drift with typed before/after values instead of raw audit blobs.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={"/admin/settings" as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Back to settings
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <AdminFlashBanner
            scope={params.adminScope}
            status={params.adminStatus}
            message={params.adminMessage}
          />
        </div>

        <div className="mt-8 grid gap-6">
          {historyGroups.map((group) => (
            <section
              key={group.setting.key}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
                    {group.setting.category}
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-slate-950">{group.setting.label}</h2>
                  <p className="mt-2 text-sm text-slate-500">{group.setting.description}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  Current: {String(group.setting.value)}
                </div>
              </div>

              {group.events.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {group.events.map((event) => (
                    <div key={event.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="font-semibold text-slate-950">{event.summary}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {event.actorUser?.fullName ?? event.actorRole} •{" "}
                            {new Date(event.createdAt).toLocaleString("vi-VN")}
                          </div>
                        </div>
                        <div className="grid min-w-[18rem] gap-2 rounded-[1rem] bg-white p-3 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Before</span>
                            <span className="font-semibold text-slate-700">
                              {event.previousValue === null ? "Default / empty" : String(event.previousValue)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">After</span>
                            <span className="font-semibold text-slate-950">
                              {event.nextValue === null ? "Default / empty" : String(event.nextValue)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-500">
                  No audit history yet. This setting is still on default or has never been changed through admin.
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
