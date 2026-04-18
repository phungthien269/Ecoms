import type { MetadataRoute } from "next";
import { flattenCategories, getSiteUrl } from "@/lib/seo";
import { getCategoryTree, getProducts, getPublicShops } from "@/lib/storefrontApi";

async function getAllProductPages() {
  const firstPage = await getProducts({ page: 1, pageSize: 100 });

  if (firstPage.pagination.totalPages <= 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pagination.totalPages - 1 }, (_, index) =>
      getProducts({
        page: index + 2,
        pageSize: 100
      })
    )
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const [categories, products, shops] = await Promise.all([
    getCategoryTree(),
    getAllProductPages(),
    getPublicShops()
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: new URL("/", siteUrl).toString(),
      lastModified: new Date()
    },
    {
      url: new URL("/products", siteUrl).toString(),
      lastModified: new Date()
    }
  ];

  const categoryEntries: MetadataRoute.Sitemap = flattenCategories(categories).map((slug) => ({
    url: new URL(`/categories/${slug}`, siteUrl).toString(),
    lastModified: new Date()
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: new URL(`/products/${product.slug}`, siteUrl).toString(),
    lastModified: new Date(product.updatedAt)
  }));

  const shopEntries: MetadataRoute.Sitemap = shops.map((shop) => ({
    url: new URL(`/shops/${shop.slug}`, siteUrl).toString(),
    lastModified: new Date(shop.updatedAt)
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries, ...shopEntries];
}
