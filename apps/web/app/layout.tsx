import type { Metadata } from "next";
import { AppShell } from "@/components/layout/appShell";
import { getChatConversations, getNotifications } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ecoms Marketplace",
  description: "Shopee-inspired marketplace built with Next.js and NestJS."
};

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getDemoSession();
  const notifications = session
    ? await getNotifications()
    : {
        items: [],
        unreadCount: 0
      };
  const conversations = session ? await getChatConversations() : [];
  const unreadChatCount = conversations.reduce(
    (sum, conversation) => sum + conversation.unreadCount,
    0
  );

  return (
    <html lang="en">
      <body>
        <AppShell
          session={session}
          unreadNotificationsCount={notifications.unreadCount}
          unreadChatCount={unreadChatCount}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
