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
