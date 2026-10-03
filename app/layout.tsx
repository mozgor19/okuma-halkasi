import type { Metadata, Viewport } from "next";
import { AppearanceProvider } from "@/components/appearance-provider";
import "./globals.css";
import "./themes.css";

const appearanceScript = `
try {
  const schemes = ["editorial", "catalogue", "notebook", "minimal"];
  const modes = ["light", "dark", "system"];
  const savedScheme = localStorage.getItem("kitapTahlilScheme");
  const savedMode = localStorage.getItem("kitapTahlilColorMode");
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
`;

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
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#15130F" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: appearanceScript }} /></head>
      <body><AppearanceProvider>{children}</AppearanceProvider></body>
    </html>
  );
}
