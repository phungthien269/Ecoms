import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductsPage from "@/app/products/page";
import { buildMetadata } from "@/lib/seo";
import { findCategoryBySlug, getCategoryTree } from "@/lib/storefrontApi";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategoryTree();
  const category = findCategoryBySlug(categories, slug);

  if (!category) {
    return buildMetadata({
      title: "Category not found",
      description: "The requested category could not be loaded from the marketplace catalog.",
      path: `/categories/${slug}`
    });
  }

  return buildMetadata({
    title: `${category.name} category`,
    description:
      category.description ??
      `Browse ${category.name} products across the marketplace with search, price filters, and shop-level discovery.`,
    path: `/categories/${slug}`,
    keywords: ["category", category.name, "marketplace"]
  });
}

export default async function CategoryDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categories = await getCategoryTree();
  const category = findCategoryBySlug(categories, slug);

  if (!category) {
    notFound();
  }

  return ProductsPage({
    searchParams: Promise.resolve({
      category: slug
    })
  });
}
