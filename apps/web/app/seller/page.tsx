import type { Route } from "next";
import Link from "next/link";
import {
  createSellerProductAction,
  createSellerVoucherAction,
  deleteSellerProductAction,
  updateSellerProductAction,
  updateSellerShopAction
} from "@/app/actions/seller";
import { formatPrice } from "@/components/commerce/price";
import { UploadAssetField } from "@/components/media/uploadAssetField";
import { EmptyState } from "@/components/storefront/emptyState";
import { flattenCategories } from "@/lib/catalog";
import {
  getSellerDashboard,
  getSellerFiles,
  getSellerProducts,
  getSellerShop,
  getSellerVouchers
} from "@/lib/commerceApi";
import { getBrands, getCategoryTree } from "@/lib/storefrontApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SellerPage() {
  const session = await getDemoSession();
  const [shop, dashboard, products, categories, brands, vouchers, files] = await Promise.all([
    getSellerShop(),
    getSellerDashboard(),
    getSellerProducts(),
    getCategoryTree(),
    getBrands(),
    getSellerVouchers(),
    getSellerFiles()
  ]);

  if (!session || session.role !== "SELLER") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as seller demo to open Seller Center"
          description="Use Seller demo button in top nav, then return here to manage seeded shop."
        />
      </main>
    );
  }

  const flatCategories = flattenCategories(categories);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Seller Center
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              {shop?.name ?? "Seller demo dashboard"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Manage listings, prep media assets, tune vouchers, keep shop ready for production flows.
            </p>
          </div>
          {shop ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={"/seller/orders" as Route}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Manage orders
              </Link>
              <Link
                href={"/seller/reviews" as Route}
                className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
              >
                Reviews
              </Link>
              <Link
                href={`/shops/${shop.slug}` as Route}
                className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
              >
                View public shop
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            {dashboard ? (
              <>
                <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
                  {[
                    { label: "Open orders", value: dashboard.stats.openOrders },
                    { label: "Completed orders", value: dashboard.stats.completedOrders },
                    { label: "Unread chats", value: dashboard.stats.unreadConversations },
                    { label: "Low stock", value: dashboard.stats.lowStockProducts },
                    { label: "Active vouchers", value: dashboard.stats.activeVouchers },
                    { label: "Products", value: dashboard.stats.totalProducts },
                    { label: "Active products", value: dashboard.stats.activeProducts },
                    { label: "Draft products", value: dashboard.stats.draftProducts },
                    { label: "Return requests", value: dashboard.stats.returnRequests },
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

                <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-slate-950">Revenue snapshot</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Completed GMV stays conservative. Open order value shows pipeline still in fulfillment.
                        </p>
                      </div>
                      <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
                        Rating {dashboard.stats.averageRating}/5
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-400">
                          Completed revenue
                        </div>
                        <div className="mt-3 text-3xl font-black">
                          {formatPrice(dashboard.revenue.completedRevenue)}
                        </div>
                      </div>
                      <div className="rounded-[1.5rem] bg-orange-50 p-5">
                        <div className="text-sm uppercase tracking-[0.18em] text-orange-500">
                          Open order value
                        </div>
                        <div className="mt-3 text-3xl font-black text-slate-950">
                          {formatPrice(dashboard.revenue.openOrderValue)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                      {dashboard.revenue.recentPerformance.map((entry) => (
                        <div key={entry.date} className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {new Date(entry.date).toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit"
                            })}
                          </div>
                          <div className="mt-2 text-sm font-bold text-slate-950">
                            {formatPrice(entry.revenue)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{entry.orders} order(s)</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-slate-950">Orders needing attention</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Pending confirmations and active return requests stay surfaced here.
                        </p>
                      </div>
                      <Link
                        href={"/seller/orders" as Route}
                        className="text-sm font-semibold text-orange-600 transition hover:text-orange-700"
                      >
                        Open queue
                      </Link>
                    </div>
                    <div className="mt-4 space-y-3">
                      {dashboard.attentionOrders.length > 0 ? (
                        dashboard.attentionOrders.map((order) => (
                          <Link
                            key={order.id}
                            href={`/seller/orders/${order.id}` as Route}
                            className="block rounded-[1.5rem] bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-semibold text-slate-950">{order.orderNumber}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                  {order.customer.fullName} • {order.status}
                                </div>
                              </div>
                              <div className="text-right text-sm font-semibold text-orange-600">
                                {formatPrice(order.grandTotal)}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                              {new Date(order.placedAt).toLocaleString("vi-VN")}
                            </div>
                          </Link>
                        ))
                      ) : (
                        <EmptyState
                          title="No urgent seller actions"
                          description="New pending and return-requested orders will surface here."
                        />
                      )}
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                  <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-xl font-bold text-slate-950">Top products</h2>
                      <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
                        By sold count
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {dashboard.topProducts.map((product) => (
                        <Link
                          key={product.id}
                          href={`/products/${product.slug}` as Route}
                          className="flex items-center gap-4 rounded-[1.5rem] bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
                        >
                          <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-slate-950">{product.name}</div>
                            <div className="mt-1 text-sm text-slate-500">
                              {product.soldCount} sold • {product.status}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-orange-600">
                              {formatPrice(product.salePrice)}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">{product.stock} left</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-xl font-bold text-slate-950">Low-stock watchlist</h2>
                      <div className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
                        Threshold ≤ 5
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {dashboard.lowStockProducts.length > 0 ? (
                        dashboard.lowStockProducts.map((product) => (
                          <div key={product.id} className="flex items-center gap-4 rounded-[1.5rem] bg-slate-50 p-4">
                            <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">
                              {product.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-semibold text-slate-950">{product.name}</div>
                              <div className="mt-1 text-sm text-slate-500">{product.status}</div>
                            </div>
                            <div className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-red-600">
                              {product.stock} left
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState
                          title="No low-stock products"
                          description="Active and draft listings are currently above the watch threshold."
                        />
                      )}
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Current listings</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Seller can edit, publish, unpublish, and delete directly here.
                  </p>
                </div>
                <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
                  {products.length} items
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {products.length > 0 ? (
                  products.map((product) => (
                    <div
                      key={product.id}
                      className="rounded-[1.5rem] border border-slate-100 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100">
                            {product.images[0]?.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.images[0].url}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div>
                            <div className="text-base font-semibold text-slate-950">{product.name}</div>
                            <div className="mt-1 text-sm text-slate-500">
                              {product.sku} • {product.status}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-orange-600">
                              {formatPrice(product.salePrice)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <form action={updateSellerProductAction}>
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="name" value={product.name} />
                            <input type="hidden" name="sku" value={product.sku} />
                            <input type="hidden" name="description" value={product.description} />
                            <input type="hidden" name="categoryId" value={product.categoryId} />
                            <input type="hidden" name="brandId" value={product.brandId ?? ""} />
                            <input type="hidden" name="originalPrice" value={product.originalPrice} />
                            <input type="hidden" name="salePrice" value={product.salePrice} />
                            <input type="hidden" name="stock" value={product.stock} />
                            <input type="hidden" name="weightGrams" value={product.weightGrams ?? ""} />
                            <input type="hidden" name="tags" value={product.tags.join(", ")} />
                            <input type="hidden" name="imageUrl" value={product.images[0]?.url ?? ""} />
                            <input type="hidden" name="imageFileAssetId" value="" />
                            <input type="hidden" name="variantName" value={product.variants[0]?.name ?? "Default"} />
                            <input type="hidden" name="variantSku" value={product.variants[0]?.sku ?? `${product.sku}-DEFAULT`} />
                            <input type="hidden" name="variantPrice" value={product.variants[0]?.price ?? product.salePrice} />
                            <input type="hidden" name="variantStock" value={product.variants[0]?.stock ?? product.stock} />
                            <input
                              type="hidden"
                              name="status"
                              value={product.status === "ACTIVE" ? "DRAFT" : "ACTIVE"}
                            />
                            <button
                              type="submit"
                              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                            >
                              {product.status === "ACTIVE" ? "Unpublish" : "Publish"}
                            </button>
                          </form>
                          <form action={deleteSellerProductAction}>
                            <input type="hidden" name="productId" value={product.id} />
                            <button
                              type="submit"
                              className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-[auto_1fr]">
                        <div className="text-sm text-slate-500">
                          <div>{product.stock} in stock</div>
                          <div>{product.variants.length} variant(s)</div>
                          <div>{product.tags.length} tag(s)</div>
                        </div>
                        <details className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                            Edit product
                          </summary>
                          <form action={updateSellerProductAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                            <input type="hidden" name="productId" value={product.id} />
                            <input name="name" defaultValue={product.name} placeholder="Product name" className={inputClass} />
                            <input name="sku" defaultValue={product.sku} placeholder="SKU" className={inputClass} />
                            <textarea
                              name="description"
                              defaultValue={product.description}
                              placeholder="Description"
                              className={`${inputClass} min-h-28 rounded-[1.5rem] sm:col-span-2`}
                            />
                            <select name="categoryId" defaultValue={product.categoryId} className={inputClass}>
                              {flatCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                            <select name="brandId" defaultValue={product.brandId ?? ""} className={inputClass}>
                              <option value="">No brand</option>
                              {brands.map((brand) => (
                                <option key={brand.id} value={brand.id}>
                                  {brand.name}
                                </option>
                              ))}
                            </select>
                            <input name="originalPrice" defaultValue={product.originalPrice} type="number" min={0} className={inputClass} />
                            <input name="salePrice" defaultValue={product.salePrice} type="number" min={0} className={inputClass} />
                            <input name="stock" defaultValue={product.stock} type="number" min={0} className={inputClass} />
                            <input name="weightGrams" defaultValue={product.weightGrams ?? ""} type="number" min={0} className={inputClass} />
                            <input name="tags" defaultValue={product.tags.join(", ")} placeholder="Tags" className={inputClass} />
                            <select name="status" defaultValue={product.status} className={inputClass}>
                              <option value="DRAFT">Draft</option>
                              <option value="ACTIVE">Active</option>
                              <option value="INACTIVE">Inactive</option>
                            </select>
                            <input
                              name="imageUrl"
                              defaultValue={product.images[0]?.url ?? ""}
                              placeholder="Image URL"
                              className={`${inputClass} sm:col-span-2`}
                            />
                            <input
                              name="imageFileAssetId"
                              defaultValue=""
                              placeholder="Prepared image asset ID"
                              className={`${inputClass} sm:col-span-2`}
                            />
                            <input name="variantName" defaultValue={product.variants[0]?.name ?? "Default"} placeholder="Variant name" className={inputClass} />
                            <input name="variantSku" defaultValue={product.variants[0]?.sku ?? `${product.sku}-DEFAULT`} placeholder="Variant SKU" className={inputClass} />
                            <input name="variantPrice" defaultValue={product.variants[0]?.price ?? product.salePrice} type="number" min={0} className={inputClass} />
                            <input name="variantStock" defaultValue={product.variants[0]?.stock ?? product.stock} type="number" min={0} className={inputClass} />
                            <button
                              type="submit"
                              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white sm:col-span-2"
                            >
                              Save product changes
                            </button>
                          </form>
                        </details>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No seller products yet"
                    description="Use create form on right to publish first seller-side product."
                  />
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-950">Media prep</h2>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {files.length} assets
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Assets mới upload sẽ tự complete và xuất hiện trong list bên dưới.
              </p>
              <div className="mt-4 space-y-3">
                {files.slice(0, 4).map((file) => (
                  <div key={file.id} className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-600">
                    <div className="font-semibold text-slate-950">{file.originalName}</div>
                    <div className="mt-1">{file.status} • {file.driver}</div>
                    <div className="mt-1 text-xs text-slate-500">{file.id}</div>
                    <div className="mt-2 break-all text-xs text-orange-600">{file.url}</div>
                  </div>
                ))}
              </div>
            </section>

            {shop ? (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">Shop profile</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update public shop identity used across storefront and admin review flows.
                </p>
                <form action={updateSellerShopAction} className="mt-5 space-y-4">
                  <input name="name" defaultValue={shop.name} placeholder="Shop name" className={inputClass} />
                  <textarea
                    name="description"
                    defaultValue={shop.description ?? ""}
                    rows={4}
                    placeholder="Shop description"
                    className={`${inputClass} min-h-28 rounded-[1.5rem]`}
                  />
                  <input
                    name="logoUrl"
                    defaultValue={shop.logoUrl ?? ""}
                    placeholder="Logo URL"
                    className={inputClass}
                  />
                  <input
                    name="bannerUrl"
                    defaultValue={shop.bannerUrl ?? ""}
                    placeholder="Banner URL"
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    className="w-full rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                  >
                    Save shop profile
                  </button>
                </form>
              </section>
            ) : null}

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Create product</h2>
              <p className="mt-1 text-sm text-slate-500">
                Posts directly to seller product API. Ready asset IDs can be attached without hand-entering CDN URLs.
              </p>

              <form action={createSellerProductAction} className="mt-5 space-y-4">
                <input name="name" placeholder="Product name" className={inputClass} />
                <input name="sku" placeholder="SKU" className={inputClass} />
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Product description"
                  className={`${inputClass} min-h-28 rounded-[1.5rem]`}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <select name="categoryId" className={inputClass}>
                    {flatCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select name="brandId" className={inputClass}>
                    <option value="">No brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                  <input name="originalPrice" type="number" min={0} placeholder="Original price" className={inputClass} />
                  <input name="salePrice" type="number" min={0} placeholder="Sale price" className={inputClass} />
                  <input name="stock" type="number" min={0} placeholder="Stock" className={inputClass} />
                  <input name="weightGrams" type="number" min={0} placeholder="Weight (grams)" className={inputClass} />
                  <input name="tags" placeholder="Tags, comma separated" className={inputClass} />
                  <select name="status" className={inputClass}>
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                  </select>
                  <input name="variantName" placeholder="Variant name" className={inputClass} />
                  <input name="variantSku" placeholder="Variant SKU" className={inputClass} />
                  <input name="variantPrice" type="number" min={0} placeholder="Variant price" className={inputClass} />
                  <input name="variantStock" type="number" min={0} placeholder="Variant stock" className={inputClass} />
                </div>
                <UploadAssetField
                  accessToken={session.accessToken}
                  folder="products"
                  assetIdInputName="imageFileAssetId"
                  urlInputName="imageUrl"
                  label="Product image upload"
                  helperText="Upload ảnh thật. Form sẽ tự nhận `fileAssetId` và URL public."
                />
                <button
                  type="submit"
                  className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Create product
                </button>
              </form>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-950">Shop vouchers</h2>
                <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
                  {vouchers.length}
                </div>
              </div>
              <form action={createSellerVoucherAction} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input name="code" placeholder="Voucher code" className={inputClass} />
                  <input name="name" placeholder="Voucher name" className={inputClass} />
                  <select name="discountType" className={inputClass}>
                    <option value="FIXED">Fixed amount</option>
                    <option value="PERCENTAGE">Percentage</option>
                  </select>
                  <input name="discountValue" type="number" min={1} placeholder="Discount value" className={inputClass} />
                  <input name="maxDiscountAmount" type="number" min={0} placeholder="Max discount" className={inputClass} />
                  <input name="minOrderValue" type="number" min={0} placeholder="Min order value" className={inputClass} />
                  <input name="totalQuantity" type="number" min={1} placeholder="Total quantity" className={inputClass} />
                  <input name="perUserUsageLimit" type="number" min={1} placeholder="Per-user limit" className={inputClass} />
                  <select name="categoryId" className={`${inputClass} sm:col-span-2`}>
                    <option value="">Applies to all categories</option>
                    {flatCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name="description"
                    placeholder="Voucher description"
                    className={`${inputClass} sm:col-span-2`}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                >
                  Create shop voucher
                </button>
              </form>
              <div className="mt-5 space-y-3">
                {vouchers.slice(0, 6).map((voucher) => (
                  <div key={voucher.id} className="rounded-[1.5rem] bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-950">{voucher.code}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {voucher.name} • used {voucher.usedCount}
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

            {shop ? (
              <section className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6">
                <h2 className="text-xl font-bold text-slate-950">Shop status</h2>
                <div className="mt-3 text-sm text-slate-600">
                  <div className="font-semibold text-orange-600">{shop.status}</div>
                  <div className="mt-1">{shop.description ?? "No shop description yet."}</div>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

const inputClass =
  "rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400";
