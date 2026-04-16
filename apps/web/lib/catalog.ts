import type { CategoryNode, ProductCatalogSearchParams } from "@/lib/storefrontTypes";

export const DEFAULT_SORT = "newest";

export function flattenCategories(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

export function collectCategoryIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap((child) => collectCategoryIds(child))];
}

export function normalizeCatalogParams(
  searchParams?: Record<string, string | string[] | undefined>
): ProductCatalogSearchParams {
  return {
    category: getSingleValue(searchParams?.category),
    search: getSingleValue(searchParams?.search),
    sort: getSingleValue(searchParams?.sort) as ProductCatalogSearchParams["sort"],
    minPrice: getSingleValue(searchParams?.minPrice),
    maxPrice: getSingleValue(searchParams?.maxPrice),
    tag: getSingleValue(searchParams?.tag),
    page: getSingleValue(searchParams?.page)
  };
}

export function buildCatalogHref(params: ProductCatalogSearchParams) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `/products?${query}` : "/products";
}

function getSingleValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}
