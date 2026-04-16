"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("ecoms_access_token")?.value;
}

async function authedMutation(path: string, init: RequestInit) {
  const token = await getToken();
  if (!token) {
    redirect("/?auth=required");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  return response.json();
}

export async function addToCartAction(formData: FormData) {
  const productId = String(formData.get("productId"));
  const productVariantId = String(formData.get("productVariantId") ?? "");
  const quantity = Number(formData.get("quantity") ?? "1");

  await authedMutation("/cart/items", {
    method: "POST",
    body: JSON.stringify({
      productId,
      productVariantId: productVariantId || undefined,
      quantity
    })
  });

  redirect("/cart?added=1");
}

export async function updateCartItemAction(formData: FormData) {
  const cartItemId = String(formData.get("cartItemId"));
  const quantity = Number(formData.get("quantity") ?? "1");

  await authedMutation(`/cart/items/${cartItemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity })
  });

  redirect("/cart");
}

export async function removeCartItemAction(formData: FormData) {
  const cartItemId = String(formData.get("cartItemId"));

  await authedMutation(`/cart/items/${cartItemId}`, {
    method: "DELETE"
  });

  redirect("/cart");
}

export async function placeOrderAction(formData: FormData) {
  const shopVoucherEntries = formData
    .getAll("shopVoucher")
    .map((value) => String(value))
    .filter(Boolean)
    .map((value) => {
      const [shopId, code] = value.split("::");
      return {
        shopId,
        code
      };
    })
    .filter((entry) => entry.shopId && entry.code);

  const payload = {
    paymentMethod: String(formData.get("paymentMethod")),
    note: String(formData.get("note") ?? "") || undefined,
    shippingAddress: {
      recipientName: String(formData.get("recipientName")),
      phoneNumber: String(formData.get("phoneNumber")),
      addressLine1: String(formData.get("addressLine1")),
      addressLine2: String(formData.get("addressLine2") ?? "") || undefined,
      ward: String(formData.get("ward") ?? "") || undefined,
      district: String(formData.get("district")),
      province: String(formData.get("province")),
      regionCode: String(formData.get("regionCode"))
    },
    vouchers: {
      platformCode: String(formData.get("platformCode") ?? "") || undefined,
      freeshipCode: String(formData.get("freeshipCode") ?? "") || undefined,
      shopCodes: shopVoucherEntries.length > 0 ? shopVoucherEntries : undefined
    }
  };

  const response = (await authedMutation("/checkout/place-order", {
    method: "POST",
    body: JSON.stringify(payload)
  })) as {
    data: {
      orders: Array<{ id: string }>;
    };
  };

  redirect(`/orders/${response.data.orders[0]?.id ?? ""}?placed=1`);
}

export async function confirmPaymentAction(formData: FormData) {
  const paymentId = String(formData.get("paymentId"));
  const orderId = String(formData.get("orderId"));

  await authedMutation(`/payments/${paymentId}/confirm`, {
    method: "POST"
  });

  redirect(`/orders/${orderId}?payment=confirmed`);
}

export async function cancelOrderAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));

  await authedMutation(`/orders/${orderId}/cancel`, {
    method: "POST"
  });

  redirect(`/orders/${orderId}?status=cancelled`);
}

export async function completeOrderAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));

  await authedMutation(`/orders/${orderId}/complete`, {
    method: "POST"
  });

  redirect(`/orders/${orderId}?status=completed`);
}

export async function addToWishlistAction(formData: FormData) {
  const productId = String(formData.get("productId"));

  await authedMutation(`/wishlist/${productId}`, {
    method: "POST"
  });

  redirect(`/products/${String(formData.get("productSlug"))}?wishlist=added`);
}

export async function removeFromWishlistAction(formData: FormData) {
  const productId = String(formData.get("productId"));

  await authedMutation(`/wishlist/${productId}`, {
    method: "DELETE"
  });

  redirect("/wishlist?removed=1");
}

export async function createReviewAction(formData: FormData) {
  const orderItemId = String(formData.get("orderItemId"));
  const orderId = String(formData.get("orderId"));
  const rating = Number(formData.get("rating") ?? "5");
  const comment = String(formData.get("comment") ?? "");

  await authedMutation("/reviews", {
    method: "POST",
    body: JSON.stringify({
      orderItemId,
      rating,
      comment
    })
  });

  redirect(`/orders/${orderId}?review=created`);
}

export async function startChatConversationAction(formData: FormData) {
  const shopId = String(formData.get("shopId") ?? "");
  const productId = String(formData.get("productId") ?? "") || undefined;
  const initialMessage =
    String(formData.get("initialMessage") ?? "") || "Hi, I'd like to ask about this product.";

  const response = (await authedMutation("/chat/conversations", {
    method: "POST",
    body: JSON.stringify({
      shopId,
      productId,
      initialMessage
    })
  })) as {
    data: {
      id: string;
    };
  };

  redirect(`/chat/${response.data.id}` as Route);
}

export async function sendChatMessageAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const content = String(formData.get("content") ?? "");

  await authedMutation(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content
    })
  });

  redirect(`/chat/${conversationId}` as Route);
}

export async function markNotificationReadAction(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/notifications");

  await authedMutation(`/notifications/${notificationId}/read`, {
    method: "PATCH"
  });

  redirect(redirectTo as Route);
}

export async function markAllNotificationsReadAction() {
  await authedMutation("/notifications/read-all", {
    method: "PATCH"
  });

  redirect("/notifications" as Route);
}
