"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("ecoms_access_token")?.value;
}

export async function updateAdminShopStatusAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/admin");
  }

  const shopId = String(formData.get("shopId") ?? "");
  const status = String(formData.get("status") ?? "");

  const response = await fetch(`${API_URL}/shops/${shopId}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/admin?shops=failed");
  }

  redirect("/admin?shops=updated");
}

export async function updateAdminProductStatusAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/admin");
  }

  const productId = String(formData.get("productId") ?? "");
  const status = String(formData.get("status") ?? "");

  const response = await fetch(`${API_URL}/products/${productId}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/admin?products=failed");
  }

  redirect("/admin?products=updated");
}

export async function createAdminCategoryAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/admin");
  }

  const response = await fetch(`${API_URL}/categories`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      parentId: String(formData.get("parentId") ?? "") || undefined
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/admin?categories=failed");
  }

  redirect("/admin?categories=created");
}

export async function createAdminBrandAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/admin");
  }

  const response = await fetch(`${API_URL}/brands`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      logoUrl: String(formData.get("logoUrl") ?? "") || undefined
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/admin?brands=failed");
  }

  redirect("/admin?brands=created");
}

export async function updateAdminOrderStatusAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/admin");
  }

  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");

  const response = await fetch(`${API_URL}/orders/admin/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/admin?orders=failed");
  }

  redirect("/admin?orders=updated");
}
