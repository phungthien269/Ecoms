import type { Route } from "next";
import Link from "next/link";
import { createSellerProductAction } from "@/app/actions/seller";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { getBrands, getCategoryTree } from "@/lib/storefrontApi";
import { getSellerProducts, getSellerShop } from "@/lib/commerceApi";
import { flattenCategories } from "@/lib/catalog";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SellerPage() {
  const session = await getDemoSession();
  const [shop, products, categories, brands] = await Promise.all([
    getSellerShop(),
    getSellerProducts(),
    getCategoryTree(),
    getBrands()
  ]);

  if (!session || session.role !== "SELLER") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as seller demo to open Seller Center"
          description="Use the Seller demo button in the top navigation, then return here to manage the seeded shop."
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
              Manage product publishing on top of the live seller APIs already wired into the backend.
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
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Current listings</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Products are fetched from `GET /api/products/me`.
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
                      className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between"
                    >
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
                      <div className="text-right text-sm text-slate-500">
                        <div>{product.stock} in stock</div>
                        <div>{product.variants.length} variant(s)</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No seller products yet"
                    description="Use the create form on the right to publish the first seller-side product."
                  />
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Create product</h2>
              <p className="mt-1 text-sm text-slate-500">
                This form posts directly to the seller product API using the demo seller session.
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
                  <input
                    name="originalPrice"
                    type="number"
                    min={0}
                    placeholder="Original price"
                    className={inputClass}
                  />
                  <input
                    name="salePrice"
                    type="number"
                    min={0}
                    placeholder="Sale price"
                    className={inputClass}
                  />
                  <input name="stock" type="number" min={0} placeholder="Stock" className={inputClass} />
                  <input
                    name="weightGrams"
                    type="number"
                    min={0}
                    placeholder="Weight (grams)"
                    className={inputClass}
                  />
                  <input name="tags" placeholder="Tags, comma separated" className={inputClass} />
                  <select name="status" className={inputClass}>
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                  </select>
                  <input
                    name="imageUrl"
                    placeholder="Image URL (optional)"
                    className={`${inputClass} sm:col-span-2`}
                  />
                  <input name="variantName" placeholder="Variant name" className={inputClass} />
                  <input name="variantSku" placeholder="Variant SKU" className={inputClass} />
                  <input
                    name="variantPrice"
                    type="number"
                    min={0}
                    placeholder="Variant price"
                    className={inputClass}
                  />
                  <input
                    name="variantStock"
                    type="number"
                    min={0}
                    placeholder="Variant stock"
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Create product
                </button>
              </form>
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
