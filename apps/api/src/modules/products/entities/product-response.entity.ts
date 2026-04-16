import type { ProductFlashSaleSummary, ProductStatus } from "@ecoms/contracts";

export interface ProductImageResponseEntity {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductVariantResponseEntity {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: string | null;
  stock: number;
  imageUrl: string | null;
  isDefault: boolean;
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
  variants: ProductVariantResponseEntity[];
  flashSale: ProductFlashSaleSummary | null;
}
