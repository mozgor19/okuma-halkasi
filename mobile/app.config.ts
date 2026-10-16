import type { ConfigContext, ExpoConfig } from "expo/config";

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const release = process.env.NODE_ENV === "production"
    || process.env.EAS_BUILD === "true"
    || ["preview", "production", "release"].includes(process.env.EAS_BUILD_PROFILE ?? "");
  const channel = process.env.OKUMA_MOBILE_CHANNEL || (release ? "production" : "development");
  if (!["development", "test", "staging", "production"].includes(channel)) throw new Error("Invalid OKUMA_MOBILE_CHANNEL.");
  if (release && ["development", "test"].includes(channel)) throw new Error("Release builds require staging or production channel.");
  const secure = release || ["staging", "production"].includes(channel);
  const configured = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (secure && !configured) throw new Error("Release requires EXPO_PUBLIC_APP_URL (HTTPS).");
  const url = new URL(configured || "http://127.0.0.1:5174");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/"
    || (url.protocol !== "https:" && (secure || url.protocol !== "http:"))) {
    throw new Error("EXPO_PUBLIC_APP_URL must be an origin without credentials, path, query or fragment; release requires HTTPS.");
  }
  if (secure && (url.hostname === "localhost" || !url.hostname.includes(".")
    || /(?:\.(?:localhost|local|invalid|test)$)|^(?:127\.|10\.|192\.168\.|169\.254\.|0\.)|^172\.(?:1[6-9]|2\d|3[01])\./i.test(url.hostname))) {
    throw new Error("Release requires a public HTTPS host, not a local or placeholder host.");
  }
  const versionCode = Number(process.env.OKUMA_ANDROID_VERSION_CODE || config.android?.versionCode || 1);
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2_100_000_000) throw new Error("Invalid Android versionCode.");
  const suffix = channel === "test" ? ".test" : channel === "staging" ? ".staging" : "";

  return {
    ...config,
    name: (config.name ?? "Okuma Halkasi") + (suffix ? ` (${channel})` : ""),
    slug: config.slug ?? "okuma-halkasi",
    ios: {
      ...config.ios,
      bundleIdentifier: (config.ios?.bundleIdentifier || "com.okumahalkasi.app") + suffix,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSCameraUsageDescription: "Bulusma ve profil fotograflari cekmek icin kamera kullanilir.",
        NSPhotoLibraryUsageDescription: "Bulusma ve profil fotograflari secmek icin fotograf arsivi kullanilir.",
      },
    },
    android: {
      ...config.android,
      package: (config.android?.package || "com.okumahalkasi.app") + suffix,
      versionCode,
      blockedPermissions: [...(config.android?.blockedPermissions || []), ...(secure ? ["android.permission.SYSTEM_ALERT_WINDOW"] : [])],
    },
    extra: { ...config.extra, appUrl: url.origin, channel },
  };
}
