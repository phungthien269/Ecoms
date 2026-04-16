import type { Route } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/storefront/emptyState";
import { getProduct } from "@/lib/storefrontApi";

function formatPrice(value: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(value));
}

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Product not available"
          description="The product detail page is wired, but the requested item could not be loaded from the API."
        />
      </main>
    );
  }

  const defaultVariant = product.variants.find((variant) => variant.isDefault) ?? product.variants[0];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={"/products" as Route}
          className="text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          Back to products
        </Link>

        <section className="mt-4 grid gap-8 rounded-[2rem] bg-white p-6 shadow-sm lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-[1.5rem] bg-slate-100">
              {product.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.images[0].url}
                  alt={product.images[0].altText ?? product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No image
                </div>
              )}
            </div>
            {product.images.length > 1 ? (
              <div className="grid grid-cols-4 gap-3">
                {product.images.slice(1, 5).map((image) => (
                  <div key={image.id} className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt={image.altText ?? product.name} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
                {product.status}
              </span>
              <h1 className="text-3xl font-black text-slate-950">{product.name}</h1>
              <p className="text-sm text-slate-500">{product.soldCount} sold • {product.ratingAverage}/5 rating</p>
            </div>

            <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <div className="flex items-end gap-3">
                <span className="text-3xl font-black">{formatPrice(product.salePrice)}</span>
                <span className="text-sm text-slate-400 line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-300">SKU: {product.sku}</p>
            </div>

            {defaultVariant ? (
              <div className="rounded-[1.5rem] border border-slate-200 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Default variant
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-900">{defaultVariant.name}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(defaultVariant.attributes).map(([key, value]) => (
                    <span
                      key={`${key}-${value}`}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {key}: {value}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.5rem] border border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900">Description</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                {product.description}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
