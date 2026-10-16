import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { AppearanceProvider } from "@/components/appearance-provider";
import { readingGroupsEnabled, resolveReadingGroup } from "@/lib/groups";
import "./globals.css";
import "./themes.css";

function appearanceScript(preset: { scheme: string; mode: string } | null) { return `
try {
  const serverAppearance = ${JSON.stringify(preset)};
  const schemes = ["editorial", "catalogue", "notebook", "minimal"];
  const modes = ["light", "dark", "system"];
  const savedScheme = serverAppearance?.scheme ?? localStorage.getItem("kitapTahlilScheme");
  const savedMode = serverAppearance?.mode ?? localStorage.getItem("kitapTahlilColorMode");
  const scheme = schemes.includes(savedScheme) ? savedScheme : "notebook";
  const mode = modes.includes(savedMode) ? savedMode : "system";
  const resolved = mode === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : mode;
  const root = document.documentElement;
  root.dataset.scheme = scheme;
  root.dataset.mode = mode;
  root.dataset.colorMode = resolved;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
} catch {}
`; }

async function groupAppearance() {
  if (!readingGroupsEnabled()) return null;
  try {
    const cookie = (await headers()).get("cookie");
    if (!cookie) return null;
    const { group } = await resolveReadingGroup(new Request("https://appearance.invalid/", { headers: { cookie } }));
    return { scheme: group.scheme, mode: group.mode };
  } catch {
    // Auth and configuration errors are handled by the proxy and protected APIs.
    return null;
  }
}

export const metadata: Metadata = {
  title: "Kitap Tahlil & İstişare",
  applicationName: "Kitap Tahlil ve İstişare",
  description: "Okuma grubunun buluşma, kitap, katılım, yorum ve fotoğraf kayıtları.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kitap Tahlil ve İstişare",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/notebook-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/notebook-apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#15130f" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appearance = await groupAppearance();
  return (
    <html lang="tr" data-scheme={appearance?.scheme} data-mode={appearance?.mode} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: appearanceScript(appearance) }} /></head>
      <body><AppearanceProvider>{children}</AppearanceProvider></body>
    </html>
  );
}
