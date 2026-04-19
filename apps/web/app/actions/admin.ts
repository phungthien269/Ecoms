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

function appendAdminFlash(
  redirectTo: string,
  flash: {
    scope: string;
    status: "success" | "error";
    message: string;
  }
) {
  const url = new URL(
    redirectTo.startsWith("http") ? redirectTo : `http://local${redirectTo.startsWith("/") ? "" : "/"}${redirectTo}`
  );
  url.searchParams.set("adminScope", flash.scope);
  url.searchParams.set("adminStatus", flash.status);
  url.searchParams.set("adminMessage", flash.message);
  return `${url.pathname}${url.search}`;
}

async function parseErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      error?: {
        message?: string;
      };
    };

    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
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
    redirectToPath(
      appendAdminFlash(redirectTo, {
        scope: "shops",
        status: "error",
        message: await parseErrorMessage(response, "Shop status update failed.")
      })
    );
  }

  redirectToPath(
    appendAdminFlash(redirectTo, {
      scope: "shops",
      status: "success",
      message: `Shop moved to ${status}.`
    })
  );
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
    redirectToPath(
      appendAdminFlash(redirectTo, {
        scope: "users",
        status: "error",
        message: await parseErrorMessage(response, "User update failed.")
      })
    );
  }

  redirectToPath(
    appendAdminFlash(redirectTo, {
      scope: "users",
      status: "success",
      message: role ? `User role updated to ${role}.` : `User account ${isActive ? "reactivated" : "suspended"}.`
    })
  );
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
    redirectToPath(
      appendAdminFlash(redirectTo, {
        scope: "products",
        status: "error",
        message: await parseErrorMessage(response, "Product status update failed.")
      })
    );
  }

  redirectToPath(
    appendAdminFlash(redirectTo, {
      scope: "products",
      status: "success",
      message: `Product moved to ${status}.`
    })
  );
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
    redirect(
      appendAdminFlash("/admin", {
        scope: "categories",
        status: "error",
        message: await parseErrorMessage(response, "Category creation failed.")
      }) as Route
    );
  }

  redirect(
    appendAdminFlash("/admin", {
      scope: "categories",
      status: "success",
      message: "Category created."
    }) as Route
  );
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
    redirect(
      appendAdminFlash("/admin", {
        scope: "brands",
        status: "error",
        message: await parseErrorMessage(response, "Brand creation failed.")
      }) as Route
    );
  }

  redirect(
    appendAdminFlash("/admin", {
      scope: "brands",
      status: "success",
      message: "Brand created."
    }) as Route
  );
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
    redirectToPath(
      appendAdminFlash(redirectTo, {
        scope: "orders",
        status: "error",
        message: await parseErrorMessage(response, "Order status update failed.")
      })
    );
  }

  redirectToPath(
    appendAdminFlash(redirectTo, {
      scope: "orders",
      status: "success",
      message: `Order moved to ${status}.`
    })
  );
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
    redirect(
      appendAdminFlash("/admin", {
        scope: "vouchers",
        status: "error",
        message: await parseErrorMessage(response, "Voucher creation failed.")
      }) as Route
    );
  }

  redirect(
    appendAdminFlash("/admin", {
      scope: "vouchers",
      status: "success",
      message: "Voucher created."
    }) as Route
  );
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
    redirect(
      appendAdminFlash("/admin", {
        scope: "flash sales",
        status: "error",
        message: await parseErrorMessage(response, "Flash sale creation failed.")
      }) as Route
    );
  }

  redirect(
    appendAdminFlash("/admin", {
      scope: "flash sales",
      status: "success",
      message: "Flash sale created."
    }) as Route
  );
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
    redirect(
      appendAdminFlash("/admin", {
        scope: "banners",
        status: "error",
        message: await parseErrorMessage(response, "Banner creation failed.")
      }) as Route
    );
  }

  redirect(
    appendAdminFlash("/admin", {
      scope: "banners",
      status: "success",
      message: "Banner created."
    }) as Route
  );
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
    redirect(
      appendAdminFlash("/admin", {
        scope: "banners",
        status: "error",
        message: await parseErrorMessage(response, "Banner update failed.")
      }) as Route
    );
  }

  redirect(
    appendAdminFlash("/admin", {
      scope: "banners",
      status: "success",
      message: "Banner updated."
    }) as Route
  );
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
    redirectToPath(
      appendAdminFlash(redirectTo, {
        scope: "reports",
        status: "error",
        message: await parseErrorMessage(response, "Report update failed.")
      })
    );
  }

  redirectToPath(
    appendAdminFlash(redirectTo, {
      scope: "reports",
      status: "success",
      message: moderationAction
        ? `Report resolved with ${moderationAction.toLowerCase().replaceAll("_", " ")}.`
        : `Report moved to ${status.toLowerCase().replaceAll("_", " ")}.`
    })
  );
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
    redirectToPath(
      appendAdminFlash(redirectTo, {
        scope: "settings",
        status: "error",
        message: await parseErrorMessage(response, "System setting update failed.")
      })
    );
  }

  redirectToPath(
    appendAdminFlash(redirectTo, {
      scope: "settings",
      status: "success",
      message: `System setting ${key} updated.`
    })
  );
}

export async function expireStalePaymentsAction(formData: FormData) {
  const token = await getToken();
  const redirectTo = getRedirectTarget(formData, "/admin/diagnostics");
  if (!token) {
    redirectToPath(redirectTo);
  }

  const response = await fetch(`${API_URL}/payments/admin/expire-stale`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    redirectToPath(
      appendAdminFlash(redirectTo, {
        scope: "payments",
        status: "error",
        message: await parseErrorMessage(response, "Payment timeout sweep failed.")
      })
    );
  }

  const payload = (await response.json()) as {
    data?: {
      expiredCount?: number;
      cancelledOrderCount?: number;
    };
  };

  redirectToPath(
    appendAdminFlash(redirectTo, {
      scope: "payments",
      status: "success",
      message: `Expired ${payload.data?.expiredCount ?? 0} payment(s), cancelled ${payload.data?.cancelledOrderCount ?? 0} order(s).`
    })
  );
}

export async function sendDiagnosticsTestEmailAction(formData: FormData) {
  const token = await getToken();
  const redirectTo = getRedirectTarget(formData, "/admin/diagnostics");
  if (!token) {
    redirectToPath(redirectTo);
  }

  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();

  const response = await fetch(`${API_URL}/health/diagnostics/test-email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      recipientEmail,
      subject: subject || undefined
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirectToPath(
      appendAdminFlash(redirectTo, {
        scope: "diagnostics",
        status: "error",
        message: await parseErrorMessage(response, "Test email failed.")
      })
    );
  }

  const payload = (await response.json()) as {
    data?: {
      accepted?: boolean;
      driver?: string;
      recipientEmail?: string;
    };
  };

  redirectToPath(
    appendAdminFlash(redirectTo, {
      scope: "diagnostics",
      status: payload.data?.accepted ? "success" : "error",
      message: payload.data?.accepted
        ? `Test email sent to ${payload.data?.recipientEmail ?? recipientEmail} via ${payload.data?.driver ?? "mailer"}.`
        : "Test email was not accepted by the configured mail driver."
    })
  );
}
