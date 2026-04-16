import type { Metadata } from "next";
import { AppShell } from "@/components/layout/appShell";
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

  return (
    <html lang="en">
      <body>
        <AppShell session={session}>{children}</AppShell>
      </body>
    </html>
  );
}
