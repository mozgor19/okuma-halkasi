import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kitap Tahlil & İstişare",
  description: "Okuma grubunun buluşma, kitap, katılım, yorum ve fotoğraf kayıtları.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
