import type { PublicSystemSettingsSummary } from "@ecoms/contracts";
import type {
  ApiEnvelope,
  BrandSummary,
  CategoryNode,
  ProductCard,
  ProductReview,
  ProductListResponse,
  ShopIndexItem,
  ShopPageData,
  StorefrontBanner,
  StorefrontFlashSale
} from "./storefrontTypes";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function requestJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      next: {
        revalidate: 60
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ApiEnvelope<T>;
    return payload.data;
  } catch {
    return null;
  }
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  return (await requestJson<CategoryNode[]>("/categories")) ?? [];
}

export async function getBrands(): Promise<BrandSummary[]> {
  return (await requestJson<BrandSummary[]>("/brands")) ?? [];
}

export async function getProducts(query?: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, String(value));
      }
    }
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  return (
    (await requestJson<ProductListResponse>(`/products${suffix}`)) ?? {
      items: [],
      pagination: {
        page: 1,
        pageSize: 12,
        total: 0,
        totalPages: 1
      }
    }
  );
}

export async function getProduct(slug: string): Promise<ProductCard | null> {
  return requestJson<ProductCard>(`/products/${slug}`);
}

export async function getProductReviews(productIdOrSlug: string): Promise<ProductReview[]> {
  return (await requestJson<ProductReview[]>(`/reviews/product/${productIdOrSlug}`)) ?? [];
}

export async function getShop(slug: string): Promise<ShopPageData | null> {
  return requestJson<ShopPageData>(`/shops/${slug}`);
}

export async function getPublicShops(): Promise<ShopIndexItem[]> {
  return (await requestJson<ShopIndexItem[]>("/shops")) ?? [];
}

export async function getActiveFlashSales(): Promise<StorefrontFlashSale[]> {
  return (await requestJson<StorefrontFlashSale[]>("/flash-sales/active")) ?? [];
}

export async function getHomeBanners(): Promise<StorefrontBanner[]> {
  return (await requestJson<StorefrontBanner[]>("/banners?placement=HOME_HERO")) ?? [];
}

export async function getPublicSystemSettings(): Promise<PublicSystemSettingsSummary> {
  return (
    (await requestJson<PublicSystemSettingsSummary>("/system-settings/public")) ?? {
      marketplaceName: "Ecoms Marketplace",
      supportEmail: "support@ecoms.local",
      paymentTimeoutMinutes: 15,
      orderAutoCompleteDays: 3
    }
  );
}

export function findCategoryBySlug(
  categories: CategoryNode[],
  slug: string
): CategoryNode | null {
  for (const category of categories) {
    if (category.slug === slug) {
      return category;
    }

    const childMatch = findCategoryBySlug(category.children, slug);
    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}
