"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("ecoms_access_token")?.value;
}

function getRedirectTarget(formData: FormData, fallback: string) {
  return String(formData.get("redirectTo") ?? "").trim() || fallback;
}

function redirectToPath(path: string) {
  redirect(path as Route);
}

export async function updateAdminShopStatusAction(formData: FormData) {
  const token = await getToken();
  const redirectTo = getRedirectTarget(formData, "/admin");
  if (!token) {
    redirectToPath(redirectTo);
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
    redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}shops=failed`);
  }

  redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}shops=updated`);
}

export async function updateAdminUserAction(formData: FormData) {
  const token = await getToken();
  const redirectTo = getRedirectTarget(formData, "/admin");
  if (!token) {
    redirectToPath(redirectTo);
  }

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") || undefined;
  const isActiveValue = String(formData.get("isActive") ?? "");
  const isActive =
    isActiveValue === "true" ? true : isActiveValue === "false" ? false : undefined;

  const response = await fetch(`${API_URL}/users/admin/${userId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      role,
      isActive
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}users=failed`);
  }

  redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}users=updated`);
}

export async function updateAdminProductStatusAction(formData: FormData) {
  const token = await getToken();
  const redirectTo = getRedirectTarget(formData, "/admin");
  if (!token) {
    redirectToPath(redirectTo);
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
    redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}products=failed`);
  }

  redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}products=updated`);
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
  const redirectTo = getRedirectTarget(formData, "/admin");
  if (!token) {
    redirectToPath(redirectTo);
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
    redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}orders=failed`);
  }

  redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}orders=updated`);
}

export async function createAdminVoucherAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/admin");
  }

  const response = await fetch(`${API_URL}/vouchers/admin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      scope: String(formData.get("scope") ?? "PLATFORM"),
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
    redirect("/admin?vouchers=failed");
  }

  redirect("/admin?vouchers=created");
}

export async function createAdminFlashSaleAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/admin");
  }

  const items = String(formData.get("items") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [productId, flashPrice, stockLimit, sortOrder] = line
        .split("|")
        .map((value) => value.trim());

      return {
        productId,
        flashPrice: Number(flashPrice),
        stockLimit: Number(stockLimit),
        sortOrder: sortOrder ? Number(sortOrder) : index
      };
    });

  const response = await fetch(`${API_URL}/flash-sales/admin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      bannerUrl: String(formData.get("bannerUrl") ?? "") || undefined,
      startsAt: String(formData.get("startsAt") ?? ""),
      endsAt: String(formData.get("endsAt") ?? ""),
      status: String(formData.get("status") ?? "") || undefined,
      items
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/admin?flashSale=failed");
  }

  redirect("/admin?flashSale=created");
}

export async function createAdminBannerAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/admin");
  }

  const response = await fetch(`${API_URL}/banners/admin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      title: String(formData.get("title") ?? ""),
      subtitle: String(formData.get("subtitle") ?? "") || undefined,
      description: String(formData.get("description") ?? "") || undefined,
      imageUrl: String(formData.get("imageUrl") ?? ""),
      mobileImageUrl: String(formData.get("mobileImageUrl") ?? "") || undefined,
      linkUrl: String(formData.get("linkUrl") ?? "") || undefined,
      placement: String(formData.get("placement") ?? "HOME_HERO"),
      sortOrder: Number(formData.get("sortOrder") ?? "0") || 0,
      isActive: String(formData.get("isActive") ?? "true") === "true",
      startsAt: String(formData.get("startsAt") ?? "") || undefined,
      endsAt: String(formData.get("endsAt") ?? "") || undefined
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/admin?banners=failed");
  }

  redirect("/admin?banners=created");
}

export async function updateAdminBannerAction(formData: FormData) {
  const token = await getToken();
  if (!token) {
    redirect("/admin");
  }

  const bannerId = String(formData.get("bannerId") ?? "");

  const response = await fetch(`${API_URL}/banners/admin/${bannerId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      isActive: String(formData.get("isActive") ?? "true") === "true",
      sortOrder: Number(formData.get("sortOrder") ?? "0") || 0
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect("/admin?banners=failed");
  }

  redirect("/admin?banners=updated");
}

export async function updateAdminReportStatusAction(formData: FormData) {
  const token = await getToken();
  const redirectTo = getRedirectTarget(formData, "/admin");
  if (!token) {
    redirectToPath(redirectTo);
  }

  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "");
  const moderationAction = String(formData.get("moderationAction") ?? "") || undefined;
  const resolvedNote = String(formData.get("resolvedNote") ?? "") || undefined;

  const response = await fetch(`${API_URL}/reports/admin/${reportId}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      status,
      moderationAction,
      resolvedNote
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}reports=failed`);
  }

  redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}reports=updated`);
}

export async function updateSystemSettingAction(formData: FormData) {
  const token = await getToken();
  const redirectTo = getRedirectTarget(formData, "/admin/settings");
  if (!token) {
    redirectToPath(redirectTo);
  }

  const key = String(formData.get("key") ?? "");
  const value = String(formData.get("value") ?? "");

  const response = await fetch(`${API_URL}/system-settings/admin/${key}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ value }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}settings=failed`);
  }

  redirectToPath(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}settings=updated`);
}
