import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { AppearanceProvider } from "@/components/appearance-provider";
import { GroupBrandingProvider } from "@/components/group-branding";
import { LEGACY_APPLICATION_NAME } from "@/lib/branding";
import { groupPresentation } from "@/lib/group-presentation";
import { applicationPresentation } from "@/lib/application-presentation";
import { KORU_BRAND } from "@/lib/brand-identity";
import { PwaLifecycle } from "@/components/pwa-lifecycle";
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
  const product = applicationPresentation();
  const applicationName = product.koru ? product.name : legacy ? LEGACY_APPLICATION_NAME : name;
  return {
    title: name,
    applicationName,
    description: "Okuma grubunun buluşma, kitap, katılım, yorum ve fotoğraf kayıtları.",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: applicationName,
    },
    formatDetection: { telephone: false },
    ...(product.koru ? {
      ...(product.origin ? { metadataBase: new URL(product.origin) } : {}),
      openGraph: {
        type: "website", locale: "tr_TR", siteName: KORU_BRAND.name, title: KORU_BRAND.name,
        description: KORU_BRAND.description,
        ...(product.origin ? { url: product.origin, images: [{ url: product.origin + KORU_BRAND.socialImage, width: 1200, height: 630, alt: KORU_BRAND.socialImageAlt }] } : {}),
      },
      twitter: { card: "summary_large_image", title: KORU_BRAND.name, description: KORU_BRAND.description,
        ...(product.origin ? { images: [{ url: product.origin + KORU_BRAND.socialImage, alt: KORU_BRAND.socialImageAlt }] } : {}) },
    } : {}),
    icons: product.koru ? {
      icon: [{ url: "/brand/koru-icon.svg", type: "image/svg+xml" }, { url: "/brand/koru-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/brand/koru-apple-180.png", sizes: "180x180", type: "image/png" }],
      shortcut: "/brand/koru-icon.svg",
    } : {
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
  viewportFit: "cover",
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
  const product = applicationPresentation();
  const appearance = group ? { scheme: group.scheme, mode: group.mode } : null;
  return (
    <html lang="tr" data-product={product.koru ? "koru" : undefined} data-scheme={appearance?.scheme} data-mode={appearance?.mode} suppressHydrationWarning>
      <head><link rel="manifest" href={product.koru ? KORU_BRAND.manifest : legacy ? "/manifest.webmanifest" : "/api/manifest"} crossOrigin={product.koru ? "anonymous" : "use-credentials"} /><script dangerouslySetInnerHTML={{ __html: appearanceScript(appearance) }} /></head>
      <body><GroupBrandingProvider name={name} legacy={legacy} applicationName={product.name} koru={product.koru}><AppearanceProvider><PwaLifecycle enabled={product.koru}>{children}</PwaLifecycle></AppearanceProvider></GroupBrandingProvider></body>
    </html>
  );
}
