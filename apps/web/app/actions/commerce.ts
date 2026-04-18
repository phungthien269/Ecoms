"use server";

import type { Route } from "next";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buildFlashHref, readActionErrorMessage } from "@/lib/feedback";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("ecoms_access_token")?.value;
}

async function authedMutation(path: string, init: RequestInit) {
  const token = await getToken();
  if (!token) {
    redirect(
      buildFlashHref("/", {}, {
        scope: "Authentication",
        status: "error",
        message: "Please sign in to continue."
      }) as Route
    );
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
    throw new Error(await readActionErrorMessage(response, "Request failed."));
  }

  return response.json();
}

export async function addToCartAction(formData: FormData) {
  const productId = String(formData.get("productId"));
  const productVariantId = String(formData.get("productVariantId") ?? "");
  const quantity = Number(formData.get("quantity") ?? "1");
  const redirectTo = String(formData.get("redirectTo") ?? "/cart");

  try {
    await authedMutation("/cart/items", {
      method: "POST",
      body: JSON.stringify({
        productId,
        productVariantId: productVariantId || undefined,
        quantity
      })
    });
  } catch (error) {
    redirect(
      buildFlashHref(redirectTo, {}, {
        scope: "Cart",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to add item to cart."
      }) as Route
    );
  }

  redirect(
    buildFlashHref("/cart", {}, {
      scope: "Cart",
      status: "success",
      message: "Item added to cart."
    }) as Route
  );
}

export async function updateCartItemAction(formData: FormData) {
  const cartItemId = String(formData.get("cartItemId"));
  const quantity = Number(formData.get("quantity") ?? "1");
  try {
    await authedMutation(`/cart/items/${cartItemId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity })
    });
  } catch (error) {
    redirect(
      buildFlashHref("/cart", {}, {
        scope: "Cart",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to update cart item."
      }) as Route
    );
  }

  redirect(
    buildFlashHref("/cart", {}, {
      scope: "Cart",
      status: "success",
      message: "Cart item updated."
    }) as Route
  );
}

export async function removeCartItemAction(formData: FormData) {
  const cartItemId = String(formData.get("cartItemId"));
  try {
    await authedMutation(`/cart/items/${cartItemId}`, {
      method: "DELETE"
    });
  } catch (error) {
    redirect(
      buildFlashHref("/cart", {}, {
        scope: "Cart",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to remove cart item."
      }) as Route
    );
  }

  redirect(
    buildFlashHref("/cart", {}, {
      scope: "Cart",
      status: "success",
      message: "Cart item removed."
    }) as Route
  );
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

  let response: {
    data: {
      orders: Array<{ id: string }>;
    };
  };

  try {
    response = (await authedMutation("/checkout/place-order", {
      method: "POST",
      body: JSON.stringify(payload)
    })) as {
      data: {
        orders: Array<{ id: string }>;
      };
    };
  } catch (error) {
    redirect(
      buildFlashHref("/checkout", {}, {
        scope: "Checkout",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to place order."
      }) as Route
    );
  }

  redirect(
    buildFlashHref(`/orders/${response.data.orders[0]?.id ?? ""}`, {}, {
      scope: "Order placement",
      status: "success",
      message:
        "Order placed. If you selected an online payment method, complete the pending payment below."
    }) as Route
  );
}

export async function confirmPaymentAction(formData: FormData) {
  const paymentId = String(formData.get("paymentId"));
  const orderId = String(formData.get("orderId"));
  try {
    await authedMutation(`/payments/${paymentId}/confirm`, {
      method: "POST"
    });
  } catch (error) {
    redirect(
      buildFlashHref(`/orders/${orderId}`, {}, {
        scope: "Payment",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to confirm payment."
      }) as Route
    );
  }

  redirect(
    buildFlashHref(`/orders/${orderId}`, {}, {
      scope: "Payment",
      status: "success",
      message: "Payment confirmed."
    }) as Route
  );
}

export async function simulatePaymentWebhookAction(formData: FormData) {
  const paymentId = String(formData.get("paymentId"));
  const orderId = String(formData.get("orderId"));
  const event = String(formData.get("event"));
  const occurredAt = new Date().toISOString();
  const payload = {
    paymentId,
    event,
    occurredAt
  };

  const signature = createHmac(
    "sha256",
    process.env.PAYMENT_WEBHOOK_SECRET ?? "change_me_payment_webhook"
  )
    .update([paymentId, "", event, "", occurredAt].join("|"))
    .digest("hex");

  const response = await fetch(`${API_URL}/payments/webhooks/mock`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ecoms-webhook-signature": signature
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect(
      buildFlashHref(`/orders/${orderId}`, {}, {
        scope: "Payment webhook",
        status: "error",
        message: await readActionErrorMessage(response, "Webhook simulation failed.")
      }) as Route
    );
  }

  redirect(
    buildFlashHref(`/orders/${orderId}`, {}, {
      scope: "Payment webhook",
      status: "success",
      message:
        event === "PAID"
          ? "Mock gateway callback marked the payment as paid."
          : "Mock gateway callback marked the payment as failed."
    }) as Route
  );
}

export async function cancelOrderAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  try {
    await authedMutation(`/orders/${orderId}/cancel`, {
      method: "POST"
    });
  } catch (error) {
    redirect(
      buildFlashHref(`/orders/${orderId}`, {}, {
        scope: "Order",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to cancel order."
      }) as Route
    );
  }

  redirect(
    buildFlashHref(`/orders/${orderId}`, {}, {
      scope: "Order",
      status: "success",
      message: "Order cancelled before shipping."
    }) as Route
  );
}

export async function completeOrderAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  try {
    await authedMutation(`/orders/${orderId}/complete`, {
      method: "POST"
    });
  } catch (error) {
    redirect(
      buildFlashHref(`/orders/${orderId}`, {}, {
        scope: "Order",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to complete order."
      }) as Route
    );
  }

  redirect(
    buildFlashHref(`/orders/${orderId}`, {}, {
      scope: "Order",
      status: "success",
      message: "Order marked as completed."
    }) as Route
  );
}

export async function requestReturnAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "") || undefined;

  try {
    await authedMutation(`/orders/${orderId}/return-request`, {
      method: "POST",
      body: JSON.stringify({
        reason,
        details
      })
    });
  } catch (error) {
    redirect(
      buildFlashHref(`/orders/${orderId}`, {}, {
        scope: "Return request",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to submit return request."
      }) as Route
    );
  }

  redirect(
    buildFlashHref(`/orders/${orderId}`, {}, {
      scope: "Return request",
      status: "success",
      message: "Return request submitted."
    }) as Route
  );
}

export async function updateOrderShippingAction(formData: FormData) {
  const orderId = String(formData.get("orderId") ?? "");
  try {
    await authedMutation(`/orders/${orderId}/shipping`, {
      method: "PATCH",
      body: JSON.stringify({
        recipientName: String(formData.get("recipientName") ?? ""),
        phoneNumber: String(formData.get("phoneNumber") ?? ""),
        addressLine1: String(formData.get("addressLine1") ?? ""),
        addressLine2: String(formData.get("addressLine2") ?? "") || undefined,
        ward: String(formData.get("ward") ?? "") || undefined,
        district: String(formData.get("district") ?? ""),
        province: String(formData.get("province") ?? ""),
        regionCode: String(formData.get("regionCode") ?? ""),
        note: String(formData.get("note") ?? "") || undefined
      })
    });
  } catch (error) {
    redirect(
      buildFlashHref(`/orders/${orderId}`, {}, {
        scope: "Shipping update",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to update shipping details."
      }) as Route
    );
  }

  redirect(
    buildFlashHref(`/orders/${orderId}`, {}, {
      scope: "Shipping update",
      status: "success",
      message: "Shipping details updated and seller notified."
    }) as Route
  );
}

export async function addToWishlistAction(formData: FormData) {
  const productId = String(formData.get("productId"));
  const productSlug = String(formData.get("productSlug"));
  try {
    await authedMutation(`/wishlist/${productId}`, {
      method: "POST"
    });
  } catch (error) {
    redirect(
      buildFlashHref(`/products/${productSlug}`, {}, {
        scope: "Wishlist",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to save wishlist item."
      }) as Route
    );
  }

  redirect(
    buildFlashHref(`/products/${productSlug}`, {}, {
      scope: "Wishlist",
      status: "success",
      message: "Product saved to wishlist."
    }) as Route
  );
}

export async function createAddressAction(formData: FormData) {
  try {
    await authedMutation("/addresses", {
      method: "POST",
      body: JSON.stringify(extractAddressPayload(formData))
    });
  } catch (error) {
    redirect(
      buildFlashHref("/account/addresses", {}, {
        scope: "Address book",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to save address."
      }) as Route
    );
  }

  redirect(
    buildFlashHref("/account/addresses", {}, {
      scope: "Address book",
      status: "success",
      message: "Address saved."
    }) as Route
  );
}

export async function updateAddressAction(formData: FormData) {
  const addressId = String(formData.get("addressId") ?? "");
  try {
    await authedMutation(`/addresses/${addressId}`, {
      method: "PATCH",
      body: JSON.stringify(extractAddressPayload(formData))
    });
  } catch (error) {
    redirect(
      buildFlashHref("/account/addresses", {}, {
        scope: "Address book",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to update address."
      }) as Route
    );
  }

  redirect(
    buildFlashHref("/account/addresses", {}, {
      scope: "Address book",
      status: "success",
      message: "Address updated."
    }) as Route
  );
}

export async function setDefaultAddressAction(formData: FormData) {
  const addressId = String(formData.get("addressId") ?? "");
  try {
    await authedMutation(`/addresses/${addressId}/default`, {
      method: "POST"
    });
  } catch (error) {
    redirect(
      buildFlashHref("/account/addresses", {}, {
        scope: "Address book",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to update default address."
      }) as Route
    );
  }

  redirect(
    buildFlashHref("/account/addresses", {}, {
      scope: "Address book",
      status: "success",
      message: "Default address updated."
    }) as Route
  );
}

export async function deleteAddressAction(formData: FormData) {
  const addressId = String(formData.get("addressId") ?? "");
  try {
    await authedMutation(`/addresses/${addressId}`, {
      method: "DELETE"
    });
  } catch (error) {
    redirect(
      buildFlashHref("/account/addresses", {}, {
        scope: "Address book",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to delete address."
      }) as Route
    );
  }

  redirect(
    buildFlashHref("/account/addresses", {}, {
      scope: "Address book",
      status: "success",
      message: "Address deleted."
    }) as Route
  );
}

export async function removeFromWishlistAction(formData: FormData) {
  const productId = String(formData.get("productId"));
  try {
    await authedMutation(`/wishlist/${productId}`, {
      method: "DELETE"
    });
  } catch (error) {
    redirect(
      buildFlashHref("/wishlist", {}, {
        scope: "Wishlist",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to remove wishlist item."
      }) as Route
    );
  }

  redirect(
    buildFlashHref("/wishlist", {}, {
      scope: "Wishlist",
      status: "success",
      message: "Wishlist item removed."
    }) as Route
  );
}

export async function createReviewAction(formData: FormData) {
  const orderItemId = String(formData.get("orderItemId"));
  const orderId = String(formData.get("orderId"));
  const rating = Number(formData.get("rating") ?? "5");
  const comment = String(formData.get("comment") ?? "");
  const imageFileAssetId = String(formData.get("imageFileAssetId") ?? "") || undefined;

  try {
    await authedMutation("/reviews", {
      method: "POST",
      body: JSON.stringify({
        orderItemId,
        rating,
        comment,
        imageFileAssetIds: imageFileAssetId ? [imageFileAssetId] : undefined
      })
    });
  } catch (error) {
    redirect(
      buildFlashHref(`/orders/${orderId}`, {}, {
        scope: "Review",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to submit review."
      }) as Route
    );
  }

  redirect(
    buildFlashHref(`/orders/${orderId}`, {}, {
      scope: "Review",
      status: "success",
      message: "Review submitted."
    }) as Route
  );
}

export async function startChatConversationAction(formData: FormData) {
  const shopId = String(formData.get("shopId") ?? "");
  const productId = String(formData.get("productId") ?? "") || undefined;
  const initialMessage =
    String(formData.get("initialMessage") ?? "") || "Hi, I'd like to ask about this product.";
  const redirectTo = String(formData.get("redirectTo") ?? "/chat");

  let response: {
    data: {
      id: string;
    };
  };

  try {
    response = (await authedMutation("/chat/conversations", {
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
  } catch (error) {
    redirect(
      buildFlashHref(redirectTo, {}, {
        scope: "Chat",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to open conversation."
      }) as Route
    );
  }

  redirect(`/chat/${response.data.id}` as Route);
}

export async function sendChatMessageAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const content = String(formData.get("content") ?? "");
  const imageFileAssetId = String(formData.get("imageFileAssetId") ?? "") || undefined;
  try {
    await authedMutation(`/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content,
        imageFileAssetId
      })
    });
  } catch (error) {
    redirect(
      buildFlashHref(`/chat/${conversationId}`, {}, {
        scope: "Chat",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to send message."
      }) as Route
    );
  }

  redirect(`/chat/${conversationId}` as Route);
}

export async function markNotificationReadAction(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/notifications");
  try {
    await authedMutation(`/notifications/${notificationId}/read`, {
      method: "PATCH"
    });
  } catch (error) {
    redirect(
      buildFlashHref(redirectTo, {}, {
        scope: "Notifications",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to mark notification as read."
      }) as Route
    );
  }

  redirect(
    buildFlashHref(redirectTo, {}, {
      scope: "Notifications",
      status: "success",
      message: "Notification marked as read."
    }) as Route
  );
}

export async function markAllNotificationsReadAction() {
  try {
    await authedMutation("/notifications/read-all", {
      method: "PATCH"
    });
  } catch (error) {
    redirect(
      buildFlashHref("/notifications", {}, {
        scope: "Notifications",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to mark all notifications as read."
      }) as Route
    );
  }

  redirect(
    buildFlashHref("/notifications", {}, {
      scope: "Notifications",
      status: "success",
      message: "All notifications marked as read."
    }) as Route
  );
}

export async function createReportAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/");
  try {
    await authedMutation("/reports", {
      method: "POST",
      body: JSON.stringify({
        targetType: String(formData.get("targetType") ?? ""),
        targetId: String(formData.get("targetId") ?? ""),
        reason: String(formData.get("reason") ?? ""),
        details: String(formData.get("details") ?? "") || undefined
      })
    });
  } catch (error) {
    redirect(
      buildFlashHref(redirectTo, {}, {
        scope: "Report",
        status: "error",
        message: error instanceof Error ? error.message : "Failed to submit report."
      }) as Route
    );
  }

  redirect(
    buildFlashHref(redirectTo, {}, {
      scope: "Report",
      status: "success",
      message: "Report submitted."
    }) as Route
  );
}

function extractAddressPayload(formData: FormData) {
  return {
    label: String(formData.get("label") ?? ""),
    recipientName: String(formData.get("recipientName") ?? ""),
    phoneNumber: String(formData.get("phoneNumber") ?? ""),
    addressLine1: String(formData.get("addressLine1") ?? ""),
    addressLine2: String(formData.get("addressLine2") ?? "") || undefined,
    ward: String(formData.get("ward") ?? "") || undefined,
    district: String(formData.get("district") ?? ""),
    province: String(formData.get("province") ?? ""),
    regionCode: String(formData.get("regionCode") ?? ""),
    isDefault: String(formData.get("isDefault") ?? "") === "true"
  };
}
