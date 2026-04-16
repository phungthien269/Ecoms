import type { Route } from "next";
import Link from "next/link";
import { DEFAULT_SORT, buildCatalogHref } from "@/lib/catalog";
import type { ProductCatalogSearchParams, ProductSortOption } from "@/lib/storefrontTypes";

const sortOptions: Array<{ label: string; value: ProductSortOption }> = [
  { label: "Newest", value: "newest" },
  { label: "Price: low to high", value: "price_asc" },
  { label: "Price: high to low", value: "price_desc" },
  { label: "Best selling", value: "best_selling" },
  { label: "Top rated", value: "top_rated" }
];

export function CatalogToolbar({
  total,
  currentParams
}: {
  total: number;
  currentParams: ProductCatalogSearchParams;
}) {
  const currentSort = currentParams.sort ?? DEFAULT_SORT;

  return (
    <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
          Discover
        </p>
        <p className="text-sm text-slate-600">
          {total > 0 ? `${total} products matched the current catalog query.` : "No products match the current query yet."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {sortOptions.map((option) => (
          <Link
            key={option.value}
            href={buildCatalogHref({
              ...currentParams,
              sort: option.value,
              page: undefined
            }) as Route}
            className={[
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              currentSort === option.value
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-600"
            ].join(" ")}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
