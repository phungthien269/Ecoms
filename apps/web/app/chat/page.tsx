import type { Route } from "next";
import Link from "next/link";
import { FlashBanner } from "@/components/layout/flashBanner";
import { EmptyState } from "@/components/storefront/emptyState";
import { getChatConversations } from "@/lib/commerceApi";
import { readFlash } from "@/lib/feedback";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const flash = readFlash((await searchParams) ?? {});
  const conversations = await getChatConversations();

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login to open chat"
          description="Use a buyer or seller demo session first, then revisit chat."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <FlashBanner {...flash} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
            Chat
          </p>
          <h1 className="text-3xl font-black text-slate-950">Buyer-seller inbox</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Threads are grouped per buyer and shop, with product references carried into the conversation.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/chat/${conversation.id}` as Route}
                className="block rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="text-base font-semibold text-slate-950">
                      {session.role === "SELLER"
                        ? conversation.buyer.fullName
                        : conversation.shop.name}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {conversation.isCounterpartOnline ? "Online" : "Offline"}
                    </div>
                    <div className="text-sm text-slate-500">
                      {conversation.product
                        ? `Product reference: ${conversation.product.name}`
                        : "General shop conversation"}
                    </div>
                    <div className="text-sm text-slate-600">
                      {conversation.lastMessagePreview ?? "No messages yet"}
                    </div>
                  </div>
                  <div className="text-left lg:text-right">
                    <div className="text-sm text-slate-500">
                      {conversation.lastMessageAt
                        ? new Date(conversation.lastMessageAt).toLocaleString("vi-VN")
                        : "Just opened"}
                    </div>
                    {conversation.unreadCount > 0 ? (
                      <div className="mt-2 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                        {conversation.unreadCount} unread
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <EmptyState
              title="No conversations yet"
              description="Start a chat from any product page to seed the buyer-seller inbox."
            />
          )}
        </div>
      </div>
    </main>
  );
}
