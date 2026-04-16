import type { ProductStatus } from "@ecoms/contracts";

export interface ProductImageResponseEntity {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductResponseEntity {
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
  status: ProductStatus;
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
  images: ProductImageResponseEntity[];
}
