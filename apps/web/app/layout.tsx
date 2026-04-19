import type { Metadata } from "next";
import { AppShell } from "@/components/layout/appShell";
import { getChatConversations, getNotifications } from "@/lib/commerceApi";
import { getSiteUrl } from "@/lib/seo";
import { getDemoSession } from "@/lib/session";
import { getPublicSystemSettings } from "@/lib/storefrontApi";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Ecoms Marketplace",
    template: "%s | Ecoms Marketplace"
  },
  description: "Shopee-inspired marketplace built with Next.js and NestJS.",
  applicationName: "Ecoms Marketplace",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Ecoms Marketplace",
    description: "Shopee-inspired marketplace built with Next.js and NestJS.",
    url: "/",
    siteName: "Ecoms Marketplace",
    type: "website",
    locale: "vi_VN"
  },
  twitter: {
    card: "summary_large_image",
    title: "Ecoms Marketplace",
    description: "Shopee-inspired marketplace built with Next.js and NestJS."
  }
};

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getDemoSession();
  const publicSettings = await getPublicSystemSettings();
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
          siteName={publicSettings.marketplaceName}
          supportEmail={publicSettings.supportEmail}
          paymentOnlineGatewayEnabled={publicSettings.paymentOnlineGatewayEnabled}
          paymentIncidentMessage={publicSettings.paymentIncidentMessage}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
