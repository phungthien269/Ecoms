import type { Route } from "next";
import Link from "next/link";
import type { CategoryNode } from "@/lib/storefrontTypes";

function flattenCategories(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

export function CategoryRail({ categories }: { categories: CategoryNode[] }) {
  const flatCategories = flattenCategories(categories).slice(0, 8);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {flatCategories.map((category) => (
        <Link
          key={category.id}
          href={`/products?category=${category.slug}` as Route}
          className="whitespace-nowrap rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-orange-400 hover:text-orange-600"
        >
          {category.name}
        </Link>
      ))}
    </div>
  );
}
