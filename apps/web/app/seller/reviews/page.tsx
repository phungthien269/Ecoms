import type { Route } from "next";
import Link from "next/link";
import { replySellerReviewAction } from "@/app/actions/seller";
import { FlashBanner } from "@/components/layout/flashBanner";
import { EmptyState } from "@/components/storefront/emptyState";
import { getSellerReviews } from "@/lib/commerceApi";
import { readFlash } from "@/lib/feedback";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SellerReviewsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const flash = readFlash((await searchParams) ?? {});
  const reviews = await getSellerReviews();

  if (!session || session.role !== "SELLER") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login as seller demo to manage reviews"
          description="Use the Seller demo login in the top navigation, then revisit this page."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <FlashBanner {...flash} />
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Seller Center
            </p>
            <h1 className="text-3xl font-black text-slate-950">Product reviews</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Reply to verified buyer feedback without leaving the seller workflow.
            </p>
          </div>
          <Link
            href={"/seller" as Route}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Back to seller center
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <section key={review.id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
                      {review.product.name}
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">{review.reviewer.fullName}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {review.reviewer.email} • {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)} • {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.5rem] bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                  {review.comment}
                </div>

                {review.sellerReply ? (
                  <div className="mt-4 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-sm font-semibold text-emerald-700">Seller reply sent</div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">{review.sellerReply}</div>
                  </div>
                ) : (
                  <form action={replySellerReviewAction} className="mt-4 rounded-[1.5rem] border border-slate-200 p-4">
                    <input type="hidden" name="reviewId" value={review.id} />
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                      <textarea
                        name="reply"
                        rows={3}
                        placeholder="Reply to this buyer review"
                        className="min-h-24 rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm text-slate-700"
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 lg:self-start"
                      >
                        Send reply
                      </button>
                    </div>
                  </form>
                )}
              </section>
            ))
          ) : (
            <EmptyState
              title="No reviews yet"
              description="Buyer reviews will appear here once completed orders are rated."
            />
          )}
        </div>
      </div>
    </main>
  );
}
