import { updateAdminProductStatusAction, updateAdminShopStatusAction } from "@/app/actions/admin";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import {
  getAdminDashboard,
  getAdminProducts,
  getAdminReviews,
  getAdminShops
} from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getDemoSession();
  const [dashboard, shops, products, reviews] = await Promise.all([
    getAdminDashboard(),
    getAdminShops(),
    getAdminProducts(),
    getAdminReviews()
  ]);

  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as admin demo to open the admin dashboard"
          description="Use the Admin demo button in the top navigation, then return here for moderation tools."
        />
      </main>
    );
  }

  if (!dashboard) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Admin dashboard unavailable"
          description="The admin API summary could not be loaded right now."
        />
      </main>
    );
  }

  const moderationShops = shops.filter((shop) => shop.status === "PENDING_APPROVAL");
  const moderationProducts = products.filter((product) => ["DRAFT", "INACTIVE"].includes(product.status));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
            Admin Dashboard
          </p>
          <h1 className="text-3xl font-black text-slate-950">Marketplace control room</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Review incoming shops, moderate product visibility, and keep an eye on orders, payments, and reviews.
          </p>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Users", value: dashboard.stats.totalUsers },
            { label: "Shops", value: dashboard.stats.totalShops },
            { label: "Pending Shops", value: dashboard.stats.pendingShops },
            { label: "Orders", value: dashboard.stats.totalOrders },
            { label: "Pending Payments", value: dashboard.stats.pendingPayments },
            { label: "Products", value: dashboard.stats.totalProducts },
            { label: "Active Products", value: dashboard.stats.activeProducts },
            { label: "Banned Products", value: dashboard.stats.bannedProducts },
            { label: "Reviews", value: dashboard.stats.totalReviews }
          ].map((item) => (
            <div key={item.label} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.label}
              </div>
              <div className="mt-3 text-3xl font-black text-slate-950">{item.value}</div>
            </div>
          ))}
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Shop approval queue</h2>
              <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
                {moderationShops.length} pending
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {moderationShops.length > 0 ? (
                moderationShops.map((shop) => (
                  <div key={shop.id} className="rounded-[1.5rem] border border-slate-100 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-base font-semibold text-slate-950">{shop.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {shop.owner.fullName} • {shop.owner.email}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <form action={updateAdminShopStatusAction}>
                          <input type="hidden" name="shopId" value={shop.id} />
                          <input type="hidden" name="status" value="ACTIVE" />
                          <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                            Approve
                          </button>
                        </form>
                        <form action={updateAdminShopStatusAction}>
                          <input type="hidden" name="shopId" value={shop.id} />
                          <input type="hidden" name="status" value="SUSPENDED" />
                          <button type="submit" className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600">
                            Suspend
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No shops waiting approval"
                  description="New seller registrations needing moderation will appear here."
                />
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Recent orders</h2>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {dashboard.recentOrders.length} latest
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {dashboard.recentOrders.map((order) => (
                <div key={order.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-950">{order.orderNumber}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {order.user.fullName} • {order.shop.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-orange-600">{order.status}</div>
                      <div className="mt-1 text-sm text-slate-500">{formatPrice(order.grandTotal)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Product moderation</h2>
              <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
                {moderationProducts.length} review items
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {moderationProducts.slice(0, 8).map((product) => (
                <div key={product.id} className="rounded-[1.5rem] border border-slate-100 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-950">{product.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {product.shop.name} • {product.sku} • {product.status}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={updateAdminProductStatusAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="status" value="ACTIVE" />
                        <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                          Activate
                        </button>
                      </form>
                      <form action={updateAdminProductStatusAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="status" value="BANNED" />
                        <button type="submit" className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600">
                          Ban
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Recent reviews</h2>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {reviews.length}
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {reviews.slice(0, 6).map((review) => (
                <div key={review.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-950">{review.product.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {review.reviewer.fullName} • {"★".repeat(review.rating)}
                      </div>
                    </div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment}</p>
                  {review.sellerReply ? (
                    <div className="mt-3 rounded-[1rem] bg-white px-3 py-2 text-sm text-slate-600">
                      Seller replied
                    </div>
                  ) : (
                    <div className="mt-3 rounded-[1rem] bg-amber-100 px-3 py-2 text-sm font-medium text-amber-700">
                      Awaiting seller reply
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
