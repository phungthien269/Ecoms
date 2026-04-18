import type { Route } from "next";
import Link from "next/link";
import { updateAdminOrderStatusAction } from "@/app/actions/admin";
import { AdminPagination } from "@/components/admin/adminPagination";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { buildAdminHref, normalizeAdminParams } from "@/lib/admin";
import { getAdminOrdersPage } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeAdminParams(resolvedParams);
  const ordersPage = await getAdminOrdersPage({
    search: params.search,
    status: params.status,
    paymentMethod: params.paymentMethod,
    page: Number(params.page ?? "1"),
    pageSize: 12
  });

  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as admin demo to inspect order backlog"
          description="Use the Admin or Super Admin demo session, then reopen this page."
        />
      </main>
    );
  }

  const redirectTo = buildAdminHref("/admin/orders", params);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Admin backlog
            </p>
            <h1 className="text-3xl font-black text-slate-950">Orders</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Filter payment and fulfillment states, then apply terminal admin overrides where needed.
            </p>
          </div>
          <Link
            href={"/admin" as Route}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Back to dashboard
          </Link>
        </div>

        <form action="/admin/orders" className="mt-8 grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Order number, buyer, shop..."
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          />
          <select name="status" defaultValue={params.status ?? ""} className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <option value="">All statuses</option>
            {["PENDING","CONFIRMED","PROCESSING","SHIPPING","DELIVERED","COMPLETED","CANCELLED","DELIVERY_FAILED","RETURN_REQUESTED","RETURNED","REFUNDED"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select name="paymentMethod" defaultValue={params.paymentMethod ?? ""} className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <option value="">All payment methods</option>
            <option value="COD">COD</option>
            <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            <option value="ONLINE_GATEWAY">ONLINE_GATEWAY</option>
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
            <h2 className="text-xl font-bold text-slate-950">Order backlog</h2>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {ordersPage.pagination.total} total
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {ordersPage.items.length > 0 ? (
              ordersPage.items.map((order) => (
                <div key={order.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-950">{order.orderNumber}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {order.customer.fullName} • {order.shop.name} • {order.status}
                      </div>
                    </div>
                    <div className="text-left lg:text-right">
                      <div className="text-sm font-semibold text-orange-600">{order.paymentMethod}</div>
                      <div className="mt-1 text-sm text-slate-500">{formatPrice(order.grandTotal)}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["CANCELLED", "DELIVERY_FAILED", "REFUNDED", "COMPLETED"].map((status) => (
                      <form key={status} action={updateAdminOrderStatusAction}>
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="status" value={status} />
                        <button
                          type="submit"
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                        >
                          Set {status.toLowerCase().replaceAll("_", " ")}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No orders match this query"
                description="Try a broader search or clear one of the active admin filters."
              />
            )}
          </div>

          <div className="mt-6">
            <AdminPagination
              basePath="/admin/orders"
              page={ordersPage.pagination.page}
              totalPages={ordersPage.pagination.totalPages}
              currentParams={params}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
