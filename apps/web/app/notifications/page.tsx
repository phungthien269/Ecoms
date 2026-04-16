import type { Route } from "next";
import Link from "next/link";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction
} from "@/app/actions/commerce";
import { EmptyState } from "@/components/storefront/emptyState";
import { getNotifications } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getDemoSession();
  const notifications = await getNotifications();

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login to inspect notifications"
          description="Use a buyer, seller, or admin demo session first."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Notifications
            </p>
            <h1 className="text-3xl font-black text-slate-950">Realtime activity center</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Order, review, promotion, and chat updates land here and are also broadcast over the realtime gateway.
            </p>
          </div>
          {notifications.items.length > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
              >
                Mark all read
              </button>
            </form>
          ) : null}
        </div>

        <div className="mt-8 space-y-4">
          {notifications.items.length > 0 ? (
            notifications.items.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-[2rem] border p-6 shadow-sm ${
                  notification.isRead
                    ? "border-slate-200 bg-white"
                    : "border-orange-200 bg-orange-50"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
                      {notification.category.replaceAll("_", " ")}
                    </div>
                    <h2 className="text-xl font-bold text-slate-950">{notification.title}</h2>
                    <p className="text-sm leading-7 text-slate-600">{notification.body}</p>
                    <div className="text-xs text-slate-400">
                      {new Date(notification.createdAt).toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {notification.linkUrl ? (
                      <Link
                        href={notification.linkUrl as Route}
                        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Open
                      </Link>
                    ) : null}
                    {!notification.isRead ? (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value="/notifications"
                        />
                        <button
                          type="submit"
                          className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                        >
                          Mark read
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="No notifications yet"
              description="New order, payment, chat, and review events will appear here."
            />
          )}
        </div>
      </div>
    </main>
  );
}
