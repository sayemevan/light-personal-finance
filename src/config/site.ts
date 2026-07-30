/**
 * Static, app-wide configuration. Values here are safe to import on both the
 * client and the server (no secrets).
 */
export const siteConfig = {
  name: "My Finance",
  description:
    "A modern personal finance manager backed entirely by your own Google account.",
  url: process.env.AUTH_URL ?? "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;
