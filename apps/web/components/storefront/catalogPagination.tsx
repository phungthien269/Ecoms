import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { buildCatalogHref } from "@/lib/catalog";
import type { ProductCatalogSearchParams } from "@/lib/storefrontTypes";

export function CatalogPagination({
  page,
  totalPages,
  currentParams
}: {
  page: number;
  totalPages: number;
  currentParams: ProductCatalogSearchParams;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(page - 3, 0),
    Math.min(Math.max(page - 3, 0) + 5, totalPages)
  );

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2">
      <PaginationLink
        page={Math.max(1, page - 1)}
        disabled={page === 1}
        currentParams={currentParams}
      >
        Previous
      </PaginationLink>

      {pages.map((pageNumber) => (
        <PaginationLink
          key={pageNumber}
          page={pageNumber}
          active={pageNumber === page}
          currentParams={currentParams}
        >
          {pageNumber}
        </PaginationLink>
      ))}

      <PaginationLink
        page={Math.min(totalPages, page + 1)}
        disabled={page === totalPages}
        currentParams={currentParams}
      >
        Next
      </PaginationLink>
    </nav>
  );
}

function PaginationLink({
  children,
  page,
  active = false,
  disabled = false,
  currentParams
}: {
  children: ReactNode;
  page: number;
  active?: boolean;
  disabled?: boolean;
  currentParams: ProductCatalogSearchParams;
}) {
  const href = buildCatalogHref({
    ...currentParams,
    page: page > 1 ? String(page) : undefined
  });

  return (
    <Link
      aria-disabled={disabled}
      href={href as Route}
      className={[
        "rounded-full border px-4 py-2 text-sm font-medium transition",
        active
          ? "border-orange-500 bg-orange-500 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-600",
        disabled ? "pointer-events-none opacity-40" : ""
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
