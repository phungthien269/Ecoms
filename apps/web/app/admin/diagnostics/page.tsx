import type { Route } from "next";
import Link from "next/link";
import { expireStalePaymentsAction, sendDiagnosticsTestEmailAction } from "@/app/actions/admin";
import { AdminFlashBanner } from "@/components/admin/adminFlashBanner";
import { EmptyState } from "@/components/storefront/emptyState";
import {
  getDiagnosticsActivity,
  getDiagnosticsMediaUploadSample,
  getDiagnosticsPaymentGatewaySample,
  getSystemDiagnostics
} from "@/lib/commerceApi";
import { normalizeAdminParams } from "@/lib/admin";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminDiagnosticsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeAdminParams(resolvedParams);
  const [diagnostics, mediaUploadSample, paymentGatewaySample, bankTransferSample, diagnosticsActivity] = await Promise.all([
    getSystemDiagnostics(),
    getDiagnosticsMediaUploadSample(),
    getDiagnosticsPaymentGatewaySample("ONLINE_GATEWAY"),
    getDiagnosticsPaymentGatewaySample("BANK_TRANSFER"),
    getDiagnosticsActivity()
  ]);

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
            <form action={expireStalePaymentsAction}>
              <input type="hidden" name="redirectTo" value="/admin/diagnostics" />
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Expire stale payments
              </button>
            </form>
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

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] bg-slate-50 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                Failing checks
              </div>
              <div className="mt-3 text-3xl font-black text-slate-950">
                {diagnostics.checks.filter((check) => check.status === "fail").length}
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-slate-50 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                Degraded checks
              </div>
              <div className="mt-3 text-3xl font-black text-slate-950">
                {diagnostics.checks.filter((check) => check.status === "degraded").length}
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-slate-50 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                Healthy checks
              </div>
              <div className="mt-3 text-3xl font-black text-slate-950">
                {diagnostics.checks.filter((check) => check.status === "ok").length}
              </div>
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
                {typeof check.details?.actionHint === "string" ? (
                  <div className="mt-4 rounded-[1rem] bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Next step
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{check.details.actionHint}</div>
                  </div>
                ) : null}
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

        <section className="mt-8 grid gap-6 xl:grid-cols-3">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Mail drill
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Send test email</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Fire a real provider send from the current runtime so operators can validate credentials,
              sender setup, and delivery acceptance.
            </p>

            <form action={sendDiagnosticsTestEmailAction} className="mt-6 grid gap-4 md:grid-cols-2">
              <input type="hidden" name="redirectTo" value="/admin/diagnostics" />
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Recipient email
                <input
                  type="email"
                  name="recipientEmail"
                  defaultValue={session.email}
                  required
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Subject
                <input
                  type="text"
                  name="subject"
                  defaultValue="Diagnostics provider test"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
                />
              </label>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Send test email
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Media drill
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Signed upload sample</h2>
            <p className="mt-2 text-sm text-slate-500">
              Live sample generated by the current media driver. Useful for verifying signed-upload
              shape before testing from the browser or a CDN edge.
            </p>

            {mediaUploadSample ? (
              <div className="mt-6 grid gap-3">
                <div className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Driver
                  </div>
                  <div className="mt-1 font-semibold text-slate-950">{mediaUploadSample.driver}</div>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Upload method
                  </div>
                  <div className="mt-1 font-semibold text-slate-950">
                    {mediaUploadSample.upload.strategy} • {mediaUploadSample.upload.method}
                  </div>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Expires at
                  </div>
                  <div className="mt-1 font-semibold text-slate-950">
                    {mediaUploadSample.upload.expiresAt
                      ? new Date(mediaUploadSample.upload.expiresAt).toLocaleString("vi-VN")
                      : "No expiry"}
                  </div>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Public URL
                  </div>
                  <div className="mt-1 break-all font-medium text-slate-950">
                    {mediaUploadSample.publicUrl}
                  </div>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Upload URL
                  </div>
                  <div className="mt-1 break-all font-medium text-slate-950">
                    {mediaUploadSample.upload.uploadUrl}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-500">
                Upload sample unavailable right now.
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Payment drill
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Gateway samples</h2>
            <p className="mt-2 text-sm text-slate-500">
              Live mock-gateway payloads generated from the current payment adapter, including webhook
              signature material for operator verification.
            </p>

            <div className="mt-6 space-y-4">
              {[paymentGatewaySample, bankTransferSample].map((sample) =>
                sample ? (
                  <div key={sample.paymentMethod} className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-950">{sample.paymentMethod}</div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {sample.provider}
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Reference
                        </div>
                        <div className="mt-1 break-all font-medium text-slate-950">{sample.referenceCode}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Expires at
                        </div>
                        <div className="mt-1 font-medium text-slate-950">
                          {new Date(sample.expiresAt).toLocaleString("vi-VN")}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Webhook signature
                        </div>
                        <div className="mt-1 break-all font-medium text-slate-950">
                          {sample.webhookSignature}
                        </div>
                      </div>
                      <details className="rounded-[1rem] bg-white p-3">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Metadata + webhook payload
                        </summary>
                        <pre className="mt-3 overflow-x-auto text-xs text-slate-600">
                          {JSON.stringify(
                            {
                              metadata: sample.metadata,
                              webhookPayload: sample.webhookPayload
                            },
                            null,
                            2
                          )}
                        </pre>
                      </details>
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Operator trace
              </div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Recent diagnostics activity</h2>
            </div>
            <Link
              href={"/admin/audit?action=health.diagnostics&entityType=HEALTH_DIAGNOSTIC" as Route}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Open full audit
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {diagnosticsActivity.length > 0 ? (
              diagnosticsActivity.map((item) => (
                <div key={item.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-950">{item.summary}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {item.actorUser?.fullName ?? item.actorRole} • {item.action}
                      </div>
                      {item.metadata ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          {Object.entries(item.metadata)
                            .filter(([key]) => key !== "requestId")
                            .map(([key, value]) => (
                              <div
                                key={key}
                                className="rounded-[1rem] bg-white px-3 py-3 text-xs text-slate-600"
                              >
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
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] bg-slate-50 p-5 text-sm text-slate-500">
                No diagnostics drills have been recorded yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
