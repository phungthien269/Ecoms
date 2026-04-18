import type { Metadata } from "next";

const DEFAULT_TITLE = "Ecoms Marketplace";
const DEFAULT_DESCRIPTION =
  "Shopee-inspired marketplace for browsing products, comparing shops, and moving from discovery to checkout with seller, admin, and promotion flows.";

function normalizeSiteUrl(rawUrl?: string) {
  if (rawUrl) {
    return rawUrl;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function getSiteUrl() {
  return new URL(normalizeSiteUrl(process.env.FRONTEND_URL));
}

export function absoluteUrl(path = "/") {
  return new URL(path, getSiteUrl()).toString();
}

export function truncateDescription(input: string, maxLength = 160) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildTitle(title?: string) {
  return title ? `${title} | ${DEFAULT_TITLE}` : DEFAULT_TITLE;
}

export function buildMetadata(input: {
  title?: string;
  description?: string;
  path?: string;
  imageUrl?: string | null;
  keywords?: string[];
}): Metadata {
  const description = truncateDescription(input.description ?? DEFAULT_DESCRIPTION);
  const url = absoluteUrl(input.path ?? "/");
  const title = input.title ?? DEFAULT_TITLE;
  const fullTitle = buildTitle(input.title);
  const image = input.imageUrl ?? null;

  return {
    title,
    description,
    keywords: input.keywords,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: DEFAULT_TITLE,
      type: "website",
      locale: "vi_VN",
      images: image
        ? [
            {
              url: image,
              alt: input.title ?? DEFAULT_TITLE
            }
          ]
        : undefined
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: fullTitle,
      description,
      images: image ? [image] : undefined
    }
  };
}

export function flattenCategories(categories: Array<{ slug: string; children: unknown[] }>) {
  const entries: string[] = [];

  const walk = (nodes: Array<{ slug: string; children: unknown[] }>) => {
    for (const node of nodes) {
      entries.push(node.slug);
      walk(node.children as Array<{ slug: string; children: unknown[] }>);
    }
  };

  walk(categories);
  return entries;
}
