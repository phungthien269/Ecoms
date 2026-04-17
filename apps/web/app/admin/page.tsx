import {
  createAdminBannerAction,
  createAdminFlashSaleAction,
  createAdminVoucherAction,
  createAdminBrandAction,
  createAdminCategoryAction,
  updateAdminBannerAction,
  updateAdminReportStatusAction,
  updateAdminOrderStatusAction,
  updateAdminProductStatusAction,
  updateAdminShopStatusAction
} from "@/app/actions/admin";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import {
  getAdminBanners,
  getAdminBrands,
  getAdminCategories,
  getAdminDashboard,
  getAdminFlashSales,
  getAdminOrders,
  getAdminProducts,
  getAdminReports,
  getAdminReviews,
  getAdminShops,
  getAdminVouchers
} from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getDemoSession();
  const [dashboard, shops, products, reviews, categories, brands, orders, vouchers, flashSales, reports, banners] = await Promise.all([
    getAdminDashboard(),
    getAdminShops(),
    getAdminProducts(),
    getAdminReviews(),
    getAdminCategories(),
    getAdminBrands(),
    getAdminOrders(),
    getAdminVouchers(),
    getAdminFlashSales(),
    getAdminReports(),
    getAdminBanners()
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
            { label: "Flash Sales", value: dashboard.stats.totalFlashSales },
            { label: "Live Flash Sales", value: dashboard.stats.activeFlashSales },
            { label: "Banners", value: dashboard.stats.totalBanners },
            { label: "Active Banners", value: dashboard.stats.activeBanners },
            { label: "Open Reports", value: dashboard.stats.openReports },
            { label: "Products", value: dashboard.stats.totalProducts },
            { label: "Active Products", value: dashboard.stats.activeProducts },
            { label: "Banned Products", value: dashboard.stats.bannedProducts },
            { label: "Reports", value: dashboard.stats.totalReports },
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

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Category management</h2>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {categories.length}
              </div>
            </div>
            <form action={createAdminCategoryAction} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <input name="name" placeholder="New category name" className={inputClass} />
              <input name="description" placeholder="Description (optional)" className={inputClass} />
              <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                Create
              </button>
              <select name="parentId" className={`${inputClass} lg:col-span-2`}>
                <option value="">No parent category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </form>
            <div className="mt-4 space-y-3">
              {categories.slice(0, 8).map((category) => (
                <div key={category.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="font-semibold text-slate-950">{category.name}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {category.slug} {category.parentId ? "• Child category" : "• Root category"}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Brand management</h2>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {brands.length}
              </div>
            </div>
            <form action={createAdminBrandAction} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <input name="name" placeholder="New brand name" className={inputClass} />
              <input name="description" placeholder="Description (optional)" className={inputClass} />
              <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                Create
              </button>
              <input
                name="logoUrl"
                placeholder="Logo URL (optional)"
                className={`${inputClass} lg:col-span-3`}
              />
            </form>
            <div className="mt-4 space-y-3">
              {brands.slice(0, 8).map((brand) => (
                <div key={brand.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="font-semibold text-slate-950">{brand.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{brand.slug}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Voucher control</h2>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {vouchers.length}
              </div>
            </div>
            <form action={createAdminVoucherAction} className="mt-4 grid gap-3 lg:grid-cols-2">
              <input name="code" placeholder="Code" className={inputClass} />
              <input name="name" placeholder="Voucher name" className={inputClass} />
              <select name="scope" className={inputClass}>
                <option value="PLATFORM">Platform voucher</option>
                <option value="FREESHIP">Freeship voucher</option>
              </select>
              <select name="discountType" className={inputClass}>
                <option value="FIXED">Fixed amount</option>
                <option value="PERCENTAGE">Percentage</option>
              </select>
              <input name="discountValue" type="number" min={1} placeholder="Discount value" className={inputClass} />
              <input name="maxDiscountAmount" type="number" min={0} placeholder="Max discount" className={inputClass} />
              <input name="minOrderValue" type="number" min={0} placeholder="Min order value" className={inputClass} />
              <input name="totalQuantity" type="number" min={1} placeholder="Total quantity" className={inputClass} />
              <input name="perUserUsageLimit" type="number" min={1} placeholder="Per-user limit" className={inputClass} />
              <select name="categoryId" className={inputClass}>
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                name="description"
                placeholder="Description (optional)"
                className={`${inputClass} lg:col-span-2`}
              />
              <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white lg:col-span-2">
                Create voucher
              </button>
            </form>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Recent vouchers</h2>
              <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
                Platform + freeship
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {vouchers.slice(0, 8).map((voucher) => (
                <div key={voucher.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-950">{voucher.code}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {voucher.name} • {voucher.scope} • used {voucher.usedCount}
                      </div>
                    </div>
                    <div className="text-right text-sm text-orange-600">
                      {voucher.discountType === "FIXED"
                        ? formatPrice(voucher.discountValue)
                        : `${voucher.discountValue}%`}
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
              <h2 className="text-xl font-bold text-slate-950">Flash sale operations</h2>
              <div className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
                {flashSales.length} campaigns
              </div>
            </div>
            <form action={createAdminFlashSaleAction} className="mt-4 grid gap-3 lg:grid-cols-2">
              <input name="name" placeholder="Campaign name" className={inputClass} />
              <select name="status" className={inputClass}>
                <option value="">Auto status from time window</option>
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ACTIVE">Active</option>
              </select>
              <input name="startsAt" type="datetime-local" className={inputClass} />
              <input name="endsAt" type="datetime-local" className={inputClass} />
              <input
                name="bannerUrl"
                placeholder="Banner URL (optional)"
                className={`${inputClass} lg:col-span-2`}
              />
              <input
                name="description"
                placeholder="Description (optional)"
                className={`${inputClass} lg:col-span-2`}
              />
              <textarea
                name="items"
                placeholder="One line per item: productId|flashPrice|stockLimit|sortOrder"
                className="min-h-32 rounded-[1.5rem] border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 lg:col-span-2"
              />
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white lg:col-span-2"
              >
                Create flash sale
              </button>
            </form>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Recent flash sales</h2>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                Live + scheduled
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {flashSales.slice(0, 6).map((flashSale) => (
                <div key={flashSale.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-950">{flashSale.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {flashSale.status} • {flashSale.items.length} SKU(s)
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      Ends {new Date(flashSale.endsAt).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {flashSale.items.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600"
                      >
                        {item.productName} • {formatPrice(item.flashPrice)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Homepage banners</h2>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {banners.length}
              </div>
            </div>
            <form action={createAdminBannerAction} className="mt-4 grid gap-3 lg:grid-cols-2">
              <input name="title" placeholder="Banner title" className={inputClass} />
              <input name="subtitle" placeholder="Subtitle" className={inputClass} />
              <input name="imageUrl" placeholder="Desktop image URL" className={inputClass} />
              <input name="mobileImageUrl" placeholder="Mobile image URL (optional)" className={inputClass} />
              <input name="linkUrl" placeholder="CTA link (optional)" className={inputClass} />
              <input name="sortOrder" type="number" min={0} defaultValue={0} className={inputClass} />
              <input name="startsAt" type="datetime-local" className={inputClass} />
              <input name="endsAt" type="datetime-local" className={inputClass} />
              <input type="hidden" name="placement" value="HOME_HERO" />
              <select name="isActive" className={`${inputClass} lg:col-span-2`}>
                <option value="true">Active now</option>
                <option value="false">Create as inactive</option>
              </select>
              <textarea
                name="description"
                placeholder="Banner description"
                className="min-h-28 rounded-[1.5rem] border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 lg:col-span-2"
              />
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white lg:col-span-2"
              >
                Create banner
              </button>
            </form>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Recent banners</h2>
              <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
                Homepage hero
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {banners.slice(0, 6).map((banner) => (
                <div key={banner.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-950">{banner.title}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {banner.isActive ? "ACTIVE" : "INACTIVE"} • sort {banner.sortOrder}
                      </div>
                      {banner.linkUrl ? (
                        <div className="mt-2 break-all text-xs text-orange-600">{banner.linkUrl}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={updateAdminBannerAction}>
                        <input type="hidden" name="bannerId" value={banner.id} />
                        <input type="hidden" name="sortOrder" value={banner.sortOrder} />
                        <input type="hidden" name="isActive" value={banner.isActive ? "false" : "true"} />
                        <button
                          type="submit"
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                        >
                          {banner.isActive ? "Disable" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-950">Order backlog</h2>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {orders.length}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {orders.slice(0, 8).map((order) => (
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
                  {["CANCELLED", "DELIVERY_FAILED", "REFUNDED"].map((status) => (
                    <form key={status} action={updateAdminOrderStatusAction}>
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
                {order.appliedVoucherCodes.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.appliedVoucherCodes.map((code) => (
                      <div
                        key={`${order.id}-${code}`}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-600"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-950">Moderation reports</h2>
            <div className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {reports.filter((report) => ["OPEN", "IN_REVIEW"].includes(report.status)).length} active
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {reports.slice(0, 8).map((report) => (
              <div key={report.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-semibold text-slate-950">
                      {report.targetType} report • {report.reason}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {report.reporter.fullName} • {report.status} •{" "}
                      {new Date(report.createdAt).toLocaleDateString("vi-VN")}
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
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

const inputClass =
  "rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400";
