import type { Route } from "next";
import Link from "next/link";
import {
  addToCartAction,
  addToWishlistAction,
  startChatConversationAction
} from "@/app/actions/commerce";
import { formatPrice } from "@/components/commerce/price";
import { EmptyState } from "@/components/storefront/emptyState";
import { getProduct, getProductReviews } from "@/lib/storefrontApi";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, reviews] = await Promise.all([getProduct(slug), getProductReviews(slug)]);

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

            <form action={addToCartAction} className="rounded-[1.5rem] border border-orange-200 bg-orange-50 p-5">
              <input type="hidden" name="productId" value={product.id} />
              <input
                type="hidden"
                name="productVariantId"
                value={defaultVariant?.id ?? ""}
              />
              <input type="hidden" name="quantity" value="1" />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                    Quick action
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Add the default variant to the demo buyer cart and continue through checkout.
                  </p>
                </div>
                <button
                  type="submit"
                  className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Add to cart
                </button>
              </div>
            </form>

            <form action={addToWishlistAction} className="rounded-[1.5rem] border border-slate-200 p-5">
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="productSlug" value={product.slug} />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Wishlist
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Save this product for the buyer account and revisit it from the new wishlist page.
                  </p>
                </div>
                <button
                  type="submit"
                  className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                >
                  Save to wishlist
                </button>
              </div>
            </form>

            <form action={startChatConversationAction} className="rounded-[1.5rem] border border-slate-200 p-5">
              <input type="hidden" name="shopId" value={product.shopId} />
              <input type="hidden" name="productId" value={product.id} />
              <input
                type="hidden"
                name="initialMessage"
                value={`Hi, I'd like to ask about ${product.name}.`}
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Buyer-seller chat
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Open a direct thread with the shop and reference this product in the conversation.
                  </p>
                </div>
                <button
                  type="submit"
                  className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                >
                  Chat with seller
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
                Reviews
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Verified buyer feedback</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {reviews.length} review(s)
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-[1.5rem] border border-slate-200 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-base font-semibold text-slate-950">{review.reviewer.fullName}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)} • {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{review.comment}</p>
                  {review.sellerReply ? (
                    <div className="mt-4 rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-600">
                      <div className="font-semibold text-slate-950">Seller reply</div>
                      <div className="mt-2">{review.sellerReply}</div>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <EmptyState
                title="No reviews yet"
                description="Once a completed order item is reviewed, feedback will appear here."
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
