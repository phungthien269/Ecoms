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
  | "newest"
  | "price_asc"
  | "price_desc"
  | "best_selling"
  | "top_rated";

export interface ProductCatalogSearchParams {
  category?: string;
  search?: string;
  sort?: ProductSortOption;
  minPrice?: string;
  maxPrice?: string;
  tag?: string;
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
