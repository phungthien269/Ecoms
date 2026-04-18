import type { Route } from "next";
import Link from "next/link";
import { updateAdminProductStatusAction } from "@/app/actions/admin";
import { AdminPagination } from "@/components/admin/adminPagination";
import { AdminFlashBanner } from "@/components/admin/adminFlashBanner";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { buildAdminHref, clearAdminFlash, normalizeAdminParams } from "@/lib/admin";
import { getAdminProductsPage } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const params = normalizeAdminParams(resolvedParams);
  const productsPage = await getAdminProductsPage({
    search: params.search,
    status: params.status,
    shopStatus: params.shopStatus,
    page: Number(params.page ?? "1"),
    pageSize: 12
  });

  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as admin demo to inspect product moderation"
          description="Use the Admin or Super Admin demo session, then reopen this page."
        />
      </main>
    );
  }

  const cleanParams = clearAdminFlash(params);
  const redirectTo = buildAdminHref("/admin/products", cleanParams);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Admin backlog
            </p>
            <h1 className="text-3xl font-black text-slate-950">Products</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Filter marketplace listings by product status, shop state, and seller search terms.
            </p>
          </div>
          <Link
            href={"/admin" as Route}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Back to dashboard
          </Link>
        </div>

        <form action="/admin/products" className="mt-8 grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Product name, SKU, slug, shop..."
            className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700"
          />
          <select name="status" defaultValue={params.status ?? ""} className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <option value="">All product statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="BANNED">BANNED</option>
          </select>
          <select name="shopStatus" defaultValue={params.shopStatus ?? ""} className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <option value="">All shop states</option>
            <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
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
            <h2 className="text-xl font-bold text-slate-950">Product moderation</h2>
            <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
              {productsPage.pagination.total} total
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {productsPage.items.length > 0 ? (
              productsPage.items.map((product) => (
                <div key={product.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-950">{product.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {product.shop.name} • {product.sku} • {product.status}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {product.category.name}
                        {product.brand ? ` • ${product.brand.name}` : ""}
                      </div>
                    </div>
                    <div className="text-left lg:text-right">
                      <div className="text-sm font-semibold text-orange-600">
                        {formatPrice(product.salePrice)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{product.stock} stock</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["ACTIVE", "INACTIVE", "BANNED"].map((status) => (
                      <form key={status} action={updateAdminProductStatusAction}>
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="status" value={status} />
                        <button
                          type="submit"
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                        >
                          Set {status.toLowerCase()}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No products match this query"
                description="Try a broader search or clear one of the active moderation filters."
              />
            )}
          </div>

          <div className="mt-6">
            <AdminPagination
              basePath="/admin/products"
              page={productsPage.pagination.page}
              totalPages={productsPage.pagination.totalPages}
              currentParams={cleanParams}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
