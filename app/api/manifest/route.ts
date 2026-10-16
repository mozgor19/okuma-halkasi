import { LEGACY_APPLICATION_NAME } from "@/lib/branding";
import { groupPresentation } from "@/lib/group-presentation";
import { noStore } from "@/lib/groups";

export const runtime = "edge";

export async function GET(request: Request) {
  const { name, legacy } = await groupPresentation(request);
  return noStore(Response.json({
    id: "/",
    name: legacy ? LEGACY_APPLICATION_NAME : name,
    short_name: legacy ? LEGACY_APPLICATION_NAME : name,
    description: "Okuma grubunun buluşma, kitap, katılım, yorum ve fotoğraf kayıtları.",
    lang: "tr", dir: "ltr", start_url: "/", scope: "/", display: "standalone",
    background_color: "#f5f3ee", theme_color: "#14252d",
    categories: ["books", "lifestyle"],
    icons: [
      { src: "/icons/notebook-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/notebook-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/notebook-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }, { headers: { "Content-Type": "application/manifest+json" } }));
}
