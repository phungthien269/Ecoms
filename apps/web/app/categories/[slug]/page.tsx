import { notFound } from "next/navigation";
import ProductsPage from "@/app/products/page";
import { findCategoryBySlug, getCategoryTree } from "@/lib/storefrontApi";

export const dynamic = "force-dynamic";

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
