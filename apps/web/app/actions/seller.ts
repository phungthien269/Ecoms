"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("ecoms_access_token")?.value;
}

export async function createSellerProductAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/seller");
  }

  const payload = {
    name: String(formData.get("name")),
    sku: String(formData.get("sku")),
    description: String(formData.get("description")),
    categoryId: String(formData.get("categoryId")),
    brandId: String(formData.get("brandId") ?? "") || undefined,
    originalPrice: Number(formData.get("originalPrice")),
    salePrice: Number(formData.get("salePrice")),
    stock: Number(formData.get("stock")),
    weightGrams: Number(formData.get("weightGrams") ?? "0") || undefined,
    status: String(formData.get("status") ?? "DRAFT"),
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    images: [
      {
        url:
          String(formData.get("imageUrl") ?? "") ||
          "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
        altText: String(formData.get("name"))
      }
    ],
    variants: [
      {
        sku: String(formData.get("variantSku") || `${String(formData.get("sku"))}-DEFAULT`),
        name: String(formData.get("variantName") || "Default"),
        attributes: {
          type: String(formData.get("variantName") || "Default")
        },
        price: Number(formData.get("variantPrice") ?? formData.get("salePrice")),
        stock: Number(formData.get("variantStock") ?? formData.get("stock")),
        isDefault: true
      }
    ]
  };

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
