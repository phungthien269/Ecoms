import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-4 py-20 sm:px-6 lg:px-8">
        <span className="rounded-full bg-orange-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">
          404
        </span>
        <div className="space-y-3">
          <h1 className="text-4xl font-black text-slate-950">Page not found</h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600">
            The requested storefront page does not exist or is no longer publicly available.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Back to storefront
          </Link>
          <Link
            href="/products"
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Browse products
          </Link>
        </div>
      </div>
    </main>
  );
}
