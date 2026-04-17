"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("ecoms_access_token")?.value;
}

function toOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildProductPayload(formData: FormData) {
  const sku = String(formData.get("sku") ?? "");
  const salePrice = Number(formData.get("salePrice") ?? "0");
  const stock = Number(formData.get("stock") ?? "0");
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const variantName = String(formData.get("variantName") ?? "").trim() || "Default";
  const variantSku = String(formData.get("variantSku") ?? "").trim() || `${sku}-DEFAULT`;

  return {
    name: String(formData.get("name") ?? ""),
    sku,
    description: String(formData.get("description") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    brandId: String(formData.get("brandId") ?? "") || undefined,
    originalPrice: Number(formData.get("originalPrice") ?? "0"),
    salePrice,
    stock,
    weightGrams: toOptionalNumber(formData.get("weightGrams")),
    status: String(formData.get("status") ?? "DRAFT"),
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    images: imageUrl
      ? [
          {
            url: imageUrl,
            altText: String(formData.get("name") ?? "")
          }
        ]
      : [],
    variants: [
      {
        sku: variantSku,
        name: variantName,
        attributes: {
          type: variantName
        },
        price: toOptionalNumber(formData.get("variantPrice")) ?? salePrice,
        stock: toOptionalNumber(formData.get("variantStock")) ?? stock,
        isDefault: true
      }
    ]
  };
}

export async function createSellerProductAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/seller");
  }

  const payload = buildProductPayload(formData);

  const response = await fetch(`${API_URL}/products`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/seller?create=failed");
  }

  redirect("/seller?create=success");
}

export async function updateSellerProductAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/seller");
  }

  const productId = String(formData.get("productId") ?? "");
  const payload = buildProductPayload(formData);

  const response = await fetch(`${API_URL}/products/${productId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/seller?update=failed");
  }

  redirect("/seller?update=success");
}

export async function deleteSellerProductAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/seller");
  }

  const productId = String(formData.get("productId") ?? "");

  const response = await fetch(`${API_URL}/products/${productId}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/seller?delete=failed");
  }

  redirect("/seller?delete=success");
}

export async function requestSellerUploadIntentAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/seller");
  }

  const response = await fetch(`${API_URL}/files/upload-intent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      filename: String(formData.get("filename") ?? ""),
      mimeType: String(formData.get("mimeType") ?? "image/jpeg"),
      sizeBytes: toOptionalNumber(formData.get("sizeBytes")),
      folder: String(formData.get("folder") ?? "products")
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/seller?media=failed");
  }

  const payload = (await response.json()) as {
    data: {
      asset: {
        url: string;
      };
    };
  };

  redirect(`/seller?media=prepared&mediaUrl=${encodeURIComponent(payload.data.asset.url)}`);
}

export async function updateSellerOrderStatusAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/seller/orders");
  }

  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!orderId || !status) {
    redirect("/seller/orders?status=failed");
  }

  const response = await fetch(`${API_URL}/orders/seller/me/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/seller/orders?status=failed");
  }

  redirect("/seller/orders?status=success");
}

export async function replySellerReviewAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/seller/reviews");
  }

  const reviewId = String(formData.get("reviewId") ?? "");
  const reply = String(formData.get("reply") ?? "");

  if (!reviewId || !reply.trim()) {
    redirect("/seller/reviews?reply=failed");
  }

  const response = await fetch(`${API_URL}/reviews/${reviewId}/reply`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ reply }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/seller/reviews?reply=failed");
  }

  redirect("/seller/reviews?reply=success");
}

export async function updateSellerShopAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/seller");
  }

  const response = await fetch(`${API_URL}/shops/me`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name: String(formData.get("name") ?? "") || undefined,
      description: String(formData.get("description") ?? "") || undefined,
      logoUrl: String(formData.get("logoUrl") ?? "") || undefined,
      bannerUrl: String(formData.get("bannerUrl") ?? "") || undefined
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/seller?shop=failed");
  }

  redirect("/seller?shop=updated");
}

export async function createSellerVoucherAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/seller");
  }

  const response = await fetch(`${API_URL}/vouchers/shop/me`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      discountType: String(formData.get("discountType") ?? "FIXED"),
      discountValue: Number(formData.get("discountValue") ?? "0"),
      maxDiscountAmount: Number(formData.get("maxDiscountAmount") ?? "0") || undefined,
      minOrderValue: Number(formData.get("minOrderValue") ?? "0") || undefined,
      totalQuantity: Number(formData.get("totalQuantity") ?? "0") || undefined,
      perUserUsageLimit: Number(formData.get("perUserUsageLimit") ?? "1") || 1,
      categoryId: String(formData.get("categoryId") ?? "") || undefined
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/seller?voucher=failed");
  }

  redirect("/seller?voucher=created");
}
