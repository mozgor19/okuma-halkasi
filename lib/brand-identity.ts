// Approved page-and-leaf mark. All Koru surfaces share this 64 x 64 geometry.
export const KORU_MARK_PATHS = [
  "M32 4C25 10 23 17 26 23C27.5 26 30 28 32 31C34 28 36.5 26 38 23C41 17 39 10 32 4Z",
  "M7 15C18 19 27 22 29 36C17 33 8 29 7 15Z",
  "M57 15C46 19 37 22 35 36C47 33 56 29 57 15Z",
  "M6 35C18 38 27 43 30 59C23 51 14 48 6 49Z",
  "M58 35C46 38 37 43 34 59C41 51 50 48 58 49Z",
] as const;

export const KORU_BRAND = {
  name: "Koru",
  description: "Birlikte oku, düşün, paylaş. Okuma grubunun kitapları ve buluşmaları bir arada.",
  socialImage: "/brand/koru-share-v2.png",
  socialImageAlt: "Koru · Birlikte oku, düşün, paylaş.",
  manifest: "/koru.webmanifest",
  mark: "/brand/koru-mark-v2.svg",
  icon: "/brand/koru-icon-v2.svg",
  icon192: "/brand/koru-192-v2.png",
  icon512: "/brand/koru-512-v2.png",
  maskableIcon: "/brand/koru-maskable-512-v2.png",
  appleIcon: "/brand/koru-apple-180-v2.png",
  badge: "/brand/koru-badge-96-v2.png",
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
