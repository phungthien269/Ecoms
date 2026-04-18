"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buildFlashHref, readActionErrorMessage } from "@/lib/feedback";

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
  const imageFileAssetId = String(formData.get("imageFileAssetId") ?? "").trim();
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
            url: imageUrl || undefined,
            fileAssetId: imageFileAssetId || undefined,
            altText: String(formData.get("name") ?? "")
          }
        ]
      : imageFileAssetId
        ? [
            {
              fileAssetId: imageFileAssetId,
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
    redirect(
      buildFlashHref(
        "/seller",
        {},
        {
          scope: "Product create",
          status: "error",
          message: await readActionErrorMessage(response, "Failed to create product.")
        }
      ) as Route
    );
  }

  redirect(
    buildFlashHref("/seller", {}, {
      scope: "Product create",
      status: "success",
      message: "Product created."
    }) as Route
  );
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
    redirect(
      buildFlashHref(
        "/seller",
        {},
        {
          scope: "Product update",
          status: "error",
          message: await readActionErrorMessage(response, "Failed to update product.")
        }
      ) as Route
    );
  }

  redirect(
    buildFlashHref("/seller", {}, {
      scope: "Product update",
      status: "success",
      message: "Product updated."
    }) as Route
  );
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
    redirect(
      buildFlashHref(
        "/seller",
        {},
        {
          scope: "Product delete",
          status: "error",
          message: await readActionErrorMessage(response, "Failed to delete product.")
        }
      ) as Route
    );
  }

  redirect(
    buildFlashHref("/seller", {}, {
      scope: "Product delete",
      status: "success",
      message: "Product deleted."
    }) as Route
  );
}

export async function updateSellerOrderStatusAction(formData: FormData) {
  const token = await getToken();
  const redirectTo = String(formData.get("redirectTo") ?? "/seller/orders");
  if (!token) {
    redirect(redirectTo as Route);
  }

  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!orderId || !status) {
    redirect(
      buildFlashHref(redirectTo, {}, {
        scope: "Fulfillment",
        status: "error",
        message: "Missing seller order action."
      }) as Route
    );
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
    redirect(
      buildFlashHref(
        redirectTo,
        {},
        {
          scope: "Fulfillment",
          status: "error",
          message: await readActionErrorMessage(response, "Failed to update order status.")
        }
      ) as Route
    );
  }

  redirect(
    buildFlashHref(redirectTo, {}, {
      scope: "Fulfillment",
      status: "success",
      message: `Order moved to ${status.replaceAll("_", " ").toLowerCase()}.`
    }) as Route
  );
}

export async function replySellerReviewAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/seller/reviews");
  }

  const reviewId = String(formData.get("reviewId") ?? "");
  const reply = String(formData.get("reply") ?? "");

  if (!reviewId || !reply.trim()) {
    redirect(
      buildFlashHref("/seller/reviews", {}, {
        scope: "Review reply",
        status: "error",
        message: "Reply content is required."
      }) as Route
    );
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
    redirect(
      buildFlashHref(
        "/seller/reviews",
        {},
        {
          scope: "Review reply",
          status: "error",
          message: await readActionErrorMessage(response, "Failed to reply to review.")
        }
      ) as Route
    );
  }

  redirect(
    buildFlashHref("/seller/reviews", {}, {
      scope: "Review reply",
      status: "success",
      message: "Reply sent."
    }) as Route
  );
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
    redirect(
      buildFlashHref(
        "/seller",
        {},
        {
          scope: "Shop profile",
          status: "error",
          message: await readActionErrorMessage(response, "Failed to update shop profile.")
        }
      ) as Route
    );
  }

  redirect(
    buildFlashHref("/seller", {}, {
      scope: "Shop profile",
      status: "success",
      message: "Shop profile updated."
    }) as Route
  );
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
    redirect(
      buildFlashHref(
        "/seller",
        {},
        {
          scope: "Voucher create",
          status: "error",
          message: await readActionErrorMessage(response, "Failed to create shop voucher.")
        }
      ) as Route
    );
  }

  redirect(
    buildFlashHref("/seller", {}, {
      scope: "Voucher create",
      status: "success",
      message: "Shop voucher created."
    }) as Route
  );
}
