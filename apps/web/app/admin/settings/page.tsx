import type { Route } from "next";
import Link from "next/link";
import { updateSystemSettingAction } from "@/app/actions/admin";
import { AdminFlashBanner } from "@/components/admin/adminFlashBanner";
import { EmptyState } from "@/components/storefront/emptyState";
import { getSystemSettings } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";
import { normalizeAdminParams } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeAdminParams(resolvedParams);
  const settings = await getSystemSettings();
  const groupedSettings = settings.reduce<Record<string, typeof settings>>((acc, setting) => {
    acc[setting.category] = [...(acc[setting.category] ?? []), setting];
    return acc;
  }, {});
  const paymentGatewayEnabledSetting = settings.find(
    (setting) => setting.key === "payment_online_gateway_enabled"
  );
  const paymentIncidentMessageSetting = settings.find(
    (setting) => setting.key === "payment_incident_message"
  );
  const paymentGatewayEnabled = paymentGatewayEnabledSetting?.value === true;
  const paymentIncidentMessage =
    typeof paymentIncidentMessageSetting?.value === "string"
      ? paymentIncidentMessageSetting.value
      : "";

  if (!session || session.role !== "SUPER_ADMIN") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Super Admin access required"
          description="Open a Super Admin demo session to edit runtime system settings."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Super Admin
            </p>
            <h1 className="text-3xl font-black text-slate-950">System settings</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Update runtime knobs for checkout, branding, and seller operations without code edits.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={"/admin/settings/history" as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Settings history
            </Link>
            <Link
              href={"/admin" as Route}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Back to dashboard
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
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
                  Checkout incident control
                </div>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Online gateway {paymentGatewayEnabled ? "is live" : "is paused"}
                </h2>
                <p className="mt-3 text-sm text-slate-500">
                  Toggle buyer-facing online gateway availability and publish a public incident notice without redeploying the storefront.
                </p>
                <div
                  className={`mt-4 rounded-[1.5rem] px-4 py-3 text-sm ${
                    paymentGatewayEnabled
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  {paymentGatewayEnabled
                    ? "Checkout will offer online gateway normally."
                    : paymentIncidentMessage ||
                      "Storefront is currently warning buyers to use bank transfer or COD."}
                </div>
              </div>
              <div className="grid w-full gap-3 lg:max-w-md">
                <form action={updateSystemSettingAction} className="grid gap-3 rounded-[1.5rem] bg-slate-50 p-4">
                  <input type="hidden" name="redirectTo" value="/admin/settings" />
                  <input type="hidden" name="key" value="payment_online_gateway_enabled" />
                  <input
                    type="hidden"
                    name="value"
                    value={paymentGatewayEnabled ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className={`rounded-full px-5 py-3 text-sm font-semibold text-white ${
                      paymentGatewayEnabled
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {paymentGatewayEnabled ? "Pause online gateway" : "Resume online gateway"}
                  </button>
                </form>
                <form action={updateSystemSettingAction} className="grid gap-3 rounded-[1.5rem] bg-slate-50 p-4">
                  <input type="hidden" name="redirectTo" value="/admin/settings" />
                  <input type="hidden" name="key" value="payment_incident_message" />
                  <textarea
                    name="value"
                    defaultValue={paymentIncidentMessage}
                    rows={4}
                    placeholder="Optional public incident message shown across storefront and checkout."
                    className="rounded-[1.5rem] border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Save incident message
                  </button>
                </form>
              </div>
            </div>
          </section>
          {Object.entries(groupedSettings).map(([category, categorySettings]) => (
            <section
              key={category}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-5">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
                  {category}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {category === "shipping"
                    ? "Tune fallback product weight and phase-1 shipping heuristics without touching checkout code."
                    : category === "operations"
                      ? "Control live probes and signed-upload runtime behavior."
                    : category === "orders"
                      ? "Lifecycle windows and post-delivery behavior."
                      : "Runtime knobs for this system area."}
                </div>
              </div>
              <div className="grid gap-4">
                {categorySettings.map((setting) => (
                  <div key={setting.key} className="rounded-[1.5rem] bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-2xl">
                        <h2 className="text-xl font-bold text-slate-950">{setting.label}</h2>
                        <p className="mt-2 text-sm text-slate-500">{setting.description}</p>
                        <div className="mt-3 text-xs text-slate-400">
                          {setting.updatedAt
                            ? `Updated ${new Date(setting.updatedAt).toLocaleString("vi-VN")} by ${setting.updatedBy?.fullName ?? "system"}`
                            : "Using default value"}
                        </div>
                      </div>
                      <form action={updateSystemSettingAction} className="flex w-full max-w-xl flex-col gap-3 lg:w-auto">
                        <input type="hidden" name="redirectTo" value="/admin/settings" />
                        <input type="hidden" name="key" value={setting.key} />
                        {setting.valueType === "BOOLEAN" ? (
                          <select
                            name="value"
                            defaultValue={String(setting.value)}
                            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            name="value"
                            defaultValue={String(setting.value)}
                            inputMode={setting.valueType === "NUMBER" ? "numeric" : undefined}
                            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
                          />
                        )}
                        <button
                          type="submit"
                          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                        >
                          Save setting
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
