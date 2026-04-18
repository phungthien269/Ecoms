export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  children: CategoryNode[];
}

export interface BrandSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
}

export interface ProductCard {
  id: string;
  shopId: string;
  categoryId: string;
  brandId: string | null;
  name: string;
  slug: string;
  sku: string;
  description: string;
  videoUrl: string | null;
  originalPrice: string;
  salePrice: string;
  status: string;
  stock: number;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  tags: string[];
  soldCount: number;
  viewCount: number;
  ratingAverage: string;
  createdAt: string;
  updatedAt: string;
  flashSale: {
    id: string;
    flashSaleId: string;
    flashSaleName: string;
    flashPrice: string;
    originalSalePrice: string;
    stockLimit: number;
    soldCount: number;
    remainingStock: number;
    startsAt: string;
    endsAt: string;
    status: string;
  } | null;
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
    sortOrder: number;
  }>;
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    attributes: Record<string, string>;
    price: string | null;
    stock: number;
    imageUrl: string | null;
    isDefault: boolean;
  }>;
}

export interface ProductReview {
  id: string;
  reviewer: {
    id: string;
    fullName: string;
  };
  rating: number;
  comment: string;
  imageUrls: string[];
  sellerReply: string | null;
  sellerReplyAt: string | null;
  createdAt: string;
}

export interface ProductListResponse {
  items: ProductCard[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export type ProductSortOption =
  | "relevance"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "best_selling"
  | "top_rated";

export interface ProductCatalogSearchParams {
  category?: string;
  brand?: string;
  shop?: string;
  search?: string;
  sort?: ProductSortOption;
  minPrice?: string;
  maxPrice?: string;
  tag?: string;
  inStock?: string;
  page?: string;
}

export interface ShopPageData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  owner: {
    id: string;
    fullName: string;
  };
  products: Array<{
    id: string;
    name: string;
    slug: string;
    salePrice: string;
    originalPrice: string;
    status: string;
    soldCount: number;
    ratingAverage: string;
    imageUrl: string | null;
  }>;
}

export interface ShopIndexItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  productCount: number;
  updatedAt: string;
}

export interface StorefrontFlashSale {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productSlug: string;
    flashPrice: string;
    originalSalePrice: string;
    stockLimit: number;
    soldCount: number;
    remainingStock: number;
    imageUrl: string | null;
  }>;
}

export interface StorefrontBanner {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  placement: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}
