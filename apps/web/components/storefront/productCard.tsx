import type { Route } from "next";
import Link from "next/link";
import type { ProductCard as ProductCardType } from "@/lib/storefrontTypes";

function formatPrice(value: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(value));
}

export function ProductCard({ product }: { product: ProductCardType }) {
  const cover = product.images[0]?.url;
  const currentPrice = product.flashSale?.flashPrice ?? product.salePrice;

  return (
    <Link
      href={`/products/${product.slug}` as Route}
      className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative aspect-square bg-gradient-to-br from-orange-50 via-amber-50 to-slate-100">
        {product.flashSale ? (
          <div className="absolute left-3 top-3 z-10 rounded-full bg-red-500 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
            Flash Sale
          </div>
        ) : null}
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={product.images[0]?.altText ?? product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No image
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="space-y-2">
          <p className="line-clamp-2 text-sm font-semibold text-slate-900">{product.name}</p>
          <div className="flex items-end gap-2">
            <span className="text-lg font-bold text-orange-600">
              {formatPrice(currentPrice)}
            </span>
            <span className="text-xs text-slate-400 line-through">
              {formatPrice(product.originalPrice)}
            </span>
          </div>
          {product.flashSale ? (
            <div className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {product.flashSale.remainingStock} flash-sale units left
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{product.soldCount} sold</span>
          <span>{product.ratingAverage}/5</span>
        </div>
      </div>
    </Link>
  );
}
