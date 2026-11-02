export const SITE_NAME = "Forge";
export const DEFAULT_DESCRIPTION =
  "Describe a website, watch it get built live, and keep refining it in a single chat.";

const configuredSiteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
export const SITE_URL = (configuredSiteUrl || "http://localhost:3000").replace(/\/$/, "");
export const HAS_CONFIGURED_SITE_URL = Boolean(configuredSiteUrl);
export const SOCIAL_IMAGE_PATH = "/favicon.ico";

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function publicPageHead(input: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}) {
  const url = absoluteUrl(input.path);
  return {
    meta: [
      { title: input.title },
      { name: "description", content: input.description },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: input.title },
      { property: "og:description", content: input.description },
      { property: "og:image", content: absoluteUrl(SOCIAL_IMAGE_PATH) },
      { property: "og:url", content: url },
      { property: "og:type", content: input.type ?? "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: input.title },
      { name: "twitter:description", content: input.description },
      { name: "twitter:image", content: absoluteUrl(SOCIAL_IMAGE_PATH) },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export const noIndexHead = {
  meta: [
    { name: "robots", content: "noindex,nofollow,noarchive" },
    { name: "googlebot", content: "noindex,nofollow,noarchive" },
  ],
};

export function jsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data);
}
