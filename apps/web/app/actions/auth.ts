"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buildFlashHref, readActionErrorMessage } from "@/lib/feedback";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function loginWithCredentials(email: string, password: string, redirectTo: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email,
      password
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    redirect(
      buildFlashHref(
        redirectTo,
        {},
        {
          scope: "Authentication",
          status: "error",
          message: await readActionErrorMessage(response, "Demo login failed.")
        }
      ) as Route
    );
  }

  const payload = (await response.json()) as {
    data: {
      accessToken: string;
      user: {
        email: string;
        role: string;
      };
    };
  };

  const cookieStore = await cookies();
  cookieStore.set("ecoms_access_token", payload.data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
  cookieStore.set("ecoms_user_email", payload.data.user.email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
  cookieStore.set("ecoms_user_role", payload.data.user.role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  redirect(
    buildFlashHref(redirectTo, {}, {
      scope: "Authentication",
      status: "success",
      message: "Demo session started."
    }) as Route
  );
}

export async function loginBuyerDemo() {
  await loginWithCredentials("buyer@ecoms.local", "Password123!", "/cart");
}

export async function loginSellerDemo() {
  await loginWithCredentials("seller@ecoms.local", "Password123!", "/seller");
}

export async function loginAdminDemo() {
  await loginWithCredentials("admin@ecoms.local", "Password123!", "/admin");
}

export async function loginSuperAdminDemo() {
  await loginWithCredentials("superadmin@ecoms.local", "Password123!", "/admin");
}

export async function logoutDemo() {
  const cookieStore = await cookies();
  cookieStore.delete("ecoms_access_token");
  cookieStore.delete("ecoms_user_email");
  cookieStore.delete("ecoms_user_role");
  redirect(
    buildFlashHref("/", {}, {
      scope: "Authentication",
      status: "success",
      message: "Logged out."
    }) as Route
  );
}
