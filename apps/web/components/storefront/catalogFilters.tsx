import type { Route } from "next";
import Link from "next/link";
import { buildCatalogHref, flattenCategories } from "@/lib/catalog";
import type { BrandSummary, CategoryNode, ProductCatalogSearchParams } from "@/lib/storefrontTypes";

const priceRanges = [
  { label: "Under 500.000₫", minPrice: undefined, maxPrice: "500000" },
  { label: "500.000₫ - 1.000.000₫", minPrice: "500000", maxPrice: "1000000" },
  { label: "1.000.000₫ - 2.500.000₫", minPrice: "1000000", maxPrice: "2500000" },
  { label: "Above 2.500.000₫", minPrice: "2500000", maxPrice: undefined }
];

export function CatalogFilters({
  categories,
  brands,
  currentCategorySlug,
  currentParams
}: {
  categories: CategoryNode[];
  brands: BrandSummary[];
  currentCategorySlug?: string;
  currentParams: ProductCatalogSearchParams;
}) {
  const flatCategories = flattenCategories(categories);

  return (
    <aside className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
          Categories
        </p>
        <div className="space-y-2">
          <Link
            href={buildCatalogHref({
              ...currentParams,
              category: undefined,
              page: undefined
            }) as Route}
            className={pillClass(!currentCategorySlug)}
          >
            All products
          </Link>
          {flatCategories.map((category) => (
            <Link
              key={category.id}
              href={buildCatalogHref({
                ...currentParams,
                category: category.slug,
                page: undefined
              }) as Route}
              className={pillClass(currentCategorySlug === category.slug)}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
          Brands
        </p>
        <div className="space-y-2">
          <Link
            href={buildCatalogHref({
              ...currentParams,
              brand: undefined,
              page: undefined
            }) as Route}
            className={pillClass(!currentParams.brand)}
          >
            Any brand
          </Link>
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={buildCatalogHref({
                ...currentParams,
                brand: brand.slug,
                page: undefined
              }) as Route}
              className={pillClass(currentParams.brand === brand.slug)}
            >
              {brand.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
          Price range
        </p>
        <div className="space-y-2">
          <Link
            href={buildCatalogHref({
              ...currentParams,
              minPrice: undefined,
              maxPrice: undefined,
              page: undefined
            }) as Route}
            className={pillClass(!currentParams.minPrice && !currentParams.maxPrice)}
          >
            Any price
          </Link>
          {priceRanges.map((range) => (
            <Link
              key={range.label}
              href={buildCatalogHref({
                ...currentParams,
                minPrice: range.minPrice,
                maxPrice: range.maxPrice,
                page: undefined
              }) as Route}
              className={pillClass(
                currentParams.minPrice === range.minPrice &&
                  currentParams.maxPrice === range.maxPrice
              )}
            >
              {range.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
          Availability
        </p>
        <div className="space-y-2">
          <Link
            href={buildCatalogHref({
              ...currentParams,
              inStock: undefined,
              page: undefined
            }) as Route}
            className={pillClass(currentParams.inStock !== "true")}
          >
            Include all stock states
          </Link>
          <Link
            href={buildCatalogHref({
              ...currentParams,
              inStock: "true",
              page: undefined
            }) as Route}
            className={pillClass(currentParams.inStock === "true")}
          >
            In stock only
          </Link>
        </div>
      </div>

      {currentParams.search ||
      currentCategorySlug ||
      currentParams.brand ||
      currentParams.shop ||
      currentParams.minPrice ||
      currentParams.maxPrice ||
      currentParams.inStock ? (
        <Link
          href={"/products" as Route}
          className="inline-flex rounded-full border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-600 transition hover:border-orange-400 hover:text-orange-700"
        >
          Reset filters
        </Link>
      ) : null}
    </aside>
  );
}

function pillClass(active: boolean) {
  return [
    "block rounded-2xl border px-3 py-2 text-sm transition",
    active
      ? "border-orange-500 bg-orange-50 font-semibold text-orange-700"
      : "border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600"
  ].join(" ");
}
