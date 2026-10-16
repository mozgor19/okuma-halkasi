import type { ConfigContext, ExpoConfig } from "expo/config";

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const release = process.env.NODE_ENV === "production"
    || process.env.EAS_BUILD === "true"
    || ["preview", "production", "release"].includes(process.env.EAS_BUILD_PROFILE ?? "");
  const configured = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (release && !configured) throw new Error("Release requires EXPO_PUBLIC_APP_URL (HTTPS).");
  const url = new URL(configured || "http://127.0.0.1:5174");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/"
    || (url.protocol !== "https:" && (release || url.protocol !== "http:"))) {
    throw new Error("EXPO_PUBLIC_APP_URL must be an origin without credentials, path, query or fragment; release requires HTTPS.");
  }

  return {
    ...config,
    name: config.name ?? "Okuma Halkasi",
    slug: config.slug ?? "okuma-halkasi",
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSCameraUsageDescription: "Bulusma ve profil fotograflari cekmek icin kamera kullanilir.",
        NSPhotoLibraryUsageDescription: "Bulusma ve profil fotograflari secmek icin fotograf arsivi kullanilir.",
      },
    },
    extra: { ...config.extra, appUrl: url.origin },
  };
}
