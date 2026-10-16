import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { AppearanceProvider } from "@/components/appearance-provider";
import { GroupBrandingProvider } from "@/components/group-branding";
import { LEGACY_APPLICATION_NAME } from "@/lib/branding";
import { groupPresentation } from "@/lib/group-presentation";
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

async function presentation() {
  const cookie = (await headers()).get("cookie");
  return groupPresentation(new Request("https://presentation.invalid/", { headers: cookie ? { cookie } : {} }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { name, legacy } = await presentation();
  return {
    title: name,
    applicationName: legacy ? LEGACY_APPLICATION_NAME : name,
    description: "Okuma grubunun buluşma, kitap, katılım, yorum ve fotoğraf kayıtları.",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: legacy ? LEGACY_APPLICATION_NAME : name,
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
}

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
  const { name, legacy, group } = await presentation();
  const appearance = group ? { scheme: group.scheme, mode: group.mode } : null;
  return (
    <html lang="tr" data-scheme={appearance?.scheme} data-mode={appearance?.mode} suppressHydrationWarning>
      <head><link rel="manifest" href={legacy ? "/manifest.webmanifest" : "/api/manifest"} crossOrigin="use-credentials" /><script dangerouslySetInnerHTML={{ __html: appearanceScript(appearance) }} /></head>
      <body><GroupBrandingProvider name={name} legacy={legacy}><AppearanceProvider>{children}</AppearanceProvider></GroupBrandingProvider></body>
    </html>
  );
}
