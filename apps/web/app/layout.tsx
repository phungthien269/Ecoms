import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ecoms Marketplace",
  description: "Shopee-inspired marketplace built with Next.js and NestJS."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
