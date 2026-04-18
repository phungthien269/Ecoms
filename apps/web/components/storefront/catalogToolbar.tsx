import type { Route } from "next";
import Link from "next/link";
import { DEFAULT_SORT, buildCatalogHref } from "@/lib/catalog";
import type { ProductCatalogSearchParams, ProductSortOption } from "@/lib/storefrontTypes";

const sortOptions: Array<{ label: string; value: ProductSortOption }> = [
  { label: "Relevance", value: "relevance" },
  { label: "Newest", value: "newest" },
  { label: "Price: low to high", value: "price_asc" },
  { label: "Price: high to low", value: "price_desc" },
  { label: "Best selling", value: "best_selling" },
  { label: "Top rated", value: "top_rated" }
];

export function CatalogToolbar({
  total,
  currentParams,
  title
}: {
  total: number;
  currentParams: ProductCatalogSearchParams;
  title: string;
}) {
  const currentSort =
    currentParams.sort ?? (currentParams.search ? "relevance" : DEFAULT_SORT);
  const availableSorts = currentParams.search
    ? sortOptions
    : sortOptions.filter((option) => option.value !== "relevance");

  return (
    <div className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
            Discover
          </p>
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <p className="text-sm text-slate-600">
            {total > 0
              ? `${total} products matched the current catalog query.`
              : "No products match the current query yet."}
          </p>
        </div>

        <form action="/products" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {currentParams.category ? <input type="hidden" name="category" value={currentParams.category} /> : null}
          {currentParams.brand ? <input type="hidden" name="brand" value={currentParams.brand} /> : null}
          {currentParams.shop ? <input type="hidden" name="shop" value={currentParams.shop} /> : null}
          {currentParams.minPrice ? <input type="hidden" name="minPrice" value={currentParams.minPrice} /> : null}
          {currentParams.maxPrice ? <input type="hidden" name="maxPrice" value={currentParams.maxPrice} /> : null}
          {currentParams.tag ? <input type="hidden" name="tag" value={currentParams.tag} /> : null}
          {currentParams.inStock ? <input type="hidden" name="inStock" value={currentParams.inStock} /> : null}
          {currentParams.sort ? <input type="hidden" name="sort" value={currentParams.sort} /> : null}
          <input
            name="search"
            defaultValue={currentParams.search ?? ""}
            placeholder="Search product, SKU, tag..."
            className="w-full rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 sm:min-w-[280px]"
          />
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Search
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {availableSorts.map((option) => (
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

      {currentParams.search ? (
        <div className="rounded-[1.2rem] bg-orange-50 px-4 py-3 text-sm text-orange-700">
          Search query: <span className="font-semibold">{currentParams.search}</span>
          {currentSort === "relevance" ? " • ranked by relevance" : null}
        </div>
      ) : null}
    </div>
  );
}
