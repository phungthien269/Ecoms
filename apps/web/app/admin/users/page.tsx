import type { Route } from "next";
import Link from "next/link";
import { updateAdminUserAction } from "@/app/actions/admin";
import { AdminPagination } from "@/components/admin/adminPagination";
import { AdminFlashBanner } from "@/components/admin/adminFlashBanner";
import { EmptyState } from "@/components/storefront/emptyState";
import { buildAdminHref, clearAdminFlash, normalizeAdminParams } from "@/lib/admin";
import { getAdminUsersPage } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeAdminParams(resolvedParams);
  const usersPage = await getAdminUsersPage({
    search: params.search,
    role: params.role,
    isActive: params.isActive,
    page: Number(params.page ?? "1"),
    pageSize: 12
  });

  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as admin demo to inspect user governance"
          description="Use the Admin or Super Admin demo session, then reopen this page."
        />
      </main>
    );
  }

  const cleanParams = clearAdminFlash(params);
  const redirectTo = buildAdminHref("/admin/users", cleanParams);
  const canManageAdminRoles = session.role === "SUPER_ADMIN";
  const manageableRoleOptions = canManageAdminRoles
    ? ["CUSTOMER", "SELLER", "ADMIN", "SUPER_ADMIN"]
    : ["CUSTOMER", "SELLER"];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Admin backlog
            </p>
            <h1 className="text-3xl font-black text-slate-950">User governance</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Filter accounts, suspend risky users, and move roles within current privilege boundaries.
            </p>
          </div>
          <Link
            href={"/admin" as Route}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Back to dashboard
          </Link>
        </div>

        <form action="/admin/users" className="mt-8 grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Search name, email, phone, shop..."
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          />
          <select name="role" defaultValue={params.role ?? ""} className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <option value="">All roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="SELLER">Seller</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
          <select name="isActive" defaultValue={params.isActive ?? ""} className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <option value="">All account states</option>
            <option value="true">Active</option>
            <option value="false">Suspended</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
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
            <h2 className="text-xl font-bold text-slate-950">Accounts</h2>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {usersPage.pagination.total} total
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {usersPage.items.length > 0 ? (
              usersPage.items.map((user) => {
                const isSelf = user.email === session.email;

                return (
                  <div key={user.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-950">{user.fullName}</div>
                        <div className="mt-1 text-sm text-slate-500">{user.email}</div>
                        {user.phoneNumber ? (
                          <div className="mt-1 text-sm text-slate-500">{user.phoneNumber}</div>
                        ) : null}
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-semibold text-orange-600">{user.role}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                          {user.isActive ? "ACTIVE" : "SUSPENDED"}
                        </div>
                      </div>
                    </div>

                    {user.shop ? (
                      <div className="mt-3 rounded-[1rem] bg-white px-3 py-2 text-sm text-slate-600">
                        Shop: {user.shop.name} • {user.shop.status}
                      </div>
                    ) : null}

                    {isSelf ? (
                      <div className="mt-3 rounded-[1rem] bg-white px-3 py-2 text-sm text-slate-500">
                        Current session account. Admin controls are hidden here.
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <form action={updateAdminUserAction} className="flex flex-wrap gap-2">
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="isActive" value={user.isActive ? "false" : "true"} />
                          <button
                            type="submit"
                            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                          >
                            {user.isActive ? "Suspend account" : "Reactivate account"}
                          </button>
                        </form>

                        <form action={updateAdminUserAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <input type="hidden" name="userId" value={user.id} />
                          <select
                            name="role"
                            defaultValue={user.role}
                            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
                          >
                            {manageableRoleOptions.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Update role
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="xl:col-span-2">
                <EmptyState
                  title="No users match this query"
                  description="Try a broader search or clear one of the active filters."
                />
              </div>
            )}
          </div>

          <div className="mt-6">
            <AdminPagination
              basePath="/admin/users"
              page={usersPage.pagination.page}
              totalPages={usersPage.pagination.totalPages}
              currentParams={cleanParams}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
