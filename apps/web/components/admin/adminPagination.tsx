import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { buildAdminHref } from "@/lib/admin";
import type { AdminListSearchParams } from "@/lib/admin";

export function AdminPagination({
  basePath,
  page,
  totalPages,
  currentParams
}: {
  basePath: string;
  page: number;
  totalPages: number;
  currentParams: AdminListSearchParams;
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
      <AdminPaginationLink
        basePath={basePath}
        page={Math.max(1, page - 1)}
        disabled={page === 1}
        currentParams={currentParams}
      >
        Previous
      </AdminPaginationLink>

      {pages.map((pageNumber) => (
        <AdminPaginationLink
          key={pageNumber}
          basePath={basePath}
          page={pageNumber}
          active={pageNumber === page}
          currentParams={currentParams}
        >
          {pageNumber}
        </AdminPaginationLink>
      ))}

      <AdminPaginationLink
        basePath={basePath}
        page={Math.min(totalPages, page + 1)}
        disabled={page === totalPages}
        currentParams={currentParams}
      >
        Next
      </AdminPaginationLink>
    </nav>
  );
}

function AdminPaginationLink({
  children,
  basePath,
  page,
  active = false,
  disabled = false,
  currentParams
}: {
  children: ReactNode;
  basePath: string;
  page: number;
  active?: boolean;
  disabled?: boolean;
  currentParams: AdminListSearchParams;
}) {
  const href = buildAdminHref(basePath, {
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
