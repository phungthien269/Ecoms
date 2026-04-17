import { sendChatMessageAction } from "@/app/actions/commerce";
import { UploadAssetField } from "@/components/media/uploadAssetField";
import { EmptyState } from "@/components/storefront/emptyState";
import { getChatConversations, getChatMessages } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ChatConversationPage({
  params
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await getDemoSession();
  const { conversationId } = await params;
  const [conversations, messages] = await Promise.all([
    getChatConversations(),
    getChatMessages(conversationId)
  ]);

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login to view this thread"
          description="Use a buyer or seller demo session first, then reopen chat."
        />
      </main>
    );
  }

  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Conversation not found"
          description="The requested conversation could not be loaded for this account."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2 border-b border-slate-100 pb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Conversation
            </p>
            <h1 className="text-2xl font-black text-slate-950">
              {session.role === "SELLER" ? conversation.buyer.fullName : conversation.shop.name}
            </h1>
            <p className="text-sm text-slate-500">
              {conversation.product
                ? `Product reference: ${conversation.product.name}`
                : "General shop thread"}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {messages.length > 0 ? (
              messages.map((message) => {
                const isOwnMessage = message.sender.role === session.role;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-[1.5rem] px-4 py-3 text-sm shadow-sm ${
                        isOwnMessage
                          ? "bg-slate-950 text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <div className="font-semibold">{message.sender.fullName}</div>
                      {message.content ? (
                        <div className="mt-2 whitespace-pre-line">{message.content}</div>
                      ) : null}
                      {message.imageUrl ? (
                        <div className="mt-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={message.imageUrl}
                            alt="Chat attachment"
                            className="max-h-56 rounded-2xl object-cover"
                          />
                        </div>
                      ) : null}
                      {message.product ? (
                        <div className="mt-3 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                          {message.product.name}
                        </div>
                      ) : null}
                      <div className="mt-3 text-xs opacity-70">
                        {new Date(message.createdAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="No messages yet"
                description="Send the first message below to start the thread."
              />
            )}
          </div>

          <form action={sendChatMessageAction} className="mt-6 border-t border-slate-100 pt-4">
            <input type="hidden" name="conversationId" value={conversation.id} />
            <div className="flex gap-3">
              <input
                name="content"
                placeholder="Type your message"
                className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Send
              </button>
            </div>
            <div className="mt-4">
              <UploadAssetField
                accessToken={session.accessToken}
                folder="chat"
                assetIdInputName="imageFileAssetId"
                label="Chat attachment"
                helperText="Upload ảnh vào thread này. Submit message sau khi asset hiện READY."
              />
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
