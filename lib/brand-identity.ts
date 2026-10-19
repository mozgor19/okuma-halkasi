export const KORU_BRAND = {
  name: "Koru",
  description: "Birlikte oku, düşün, paylaş. Okuma grubunun kitapları ve buluşmaları bir arada.",
  socialImage: "/brand/koru-share-v1.png",
  socialImageAlt: "Koru · Birlikte oku, düşün, paylaş.",
  manifest: "/koru.webmanifest",
  ink: "#172d45",
  paper: "#fffdf7",
  yellow: "#e2c63f",
  coral: "#ec543f",
} as const;

// Only an explicitly configured origin may appear in public metadata, never a Host header.
export function brandPublicOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/"
      && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}
