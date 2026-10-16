export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const FILE_CHUNK_BYTES = 64 * 1024;
export const MAX_MESSAGE_CHARS = Math.ceil(MAX_FILE_BYTES / 3) * 4 + 4096;
const safeId = /^[A-Za-z0-9_-]{1,80}$/;

export type NativeNotificationPermission = "default" | "granted" | "denied";
export type NotificationRequest =
  | { id: string; type: "notifications:status" }
  | { id: string; type: "notifications:request" }
  | { id: string; type: "notifications:show"; key: string; title: string; body: string; url: string };

export type BridgeRequest =
  | { id: string; type: "share"; title: string; text: string; url: string }
  | { id: string; type: "file"; name: string; mimeType: "application/zip" | "text/calendar"; base64: string }
  | { id: string; type: "file:start"; transferId: string; name: string; mimeType: "application/zip" | "text/calendar"; size: number }
  | { id: string; type: "file:chunk"; transferId: string; offset: number; base64: string }
  | { id: string; type: "file:finish"; transferId: string }
  | { id: string; type: "file:cancel"; transferId: string }
  | NotificationRequest;
export type BridgeResult = { id: string; ok: boolean; error?: string; permission?: NativeNotificationPermission };
export type Validation = { ok: true; request: BridgeRequest }
  | { ok: false; id?: string; error: string };

function parseUrl(value: string): URL | null {
  if (value.length > 4096 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.username || url.password ? null : url;
  } catch { return null; }
}

function validFileMetadata(message: Record<string, unknown>): message is Record<string, unknown> & { name: string; mimeType: "application/zip" | "text/calendar" } {
  return typeof message.name === "string" && message.name.length <= 140
    && /^[\p{L}\p{N}][\p{L}\p{N} _().-]*\.(zip|ics)$/u.test(message.name)
    && !message.name.includes("..")
    && ((message.mimeType === "application/zip" && message.name.endsWith(".zip"))
      || (message.mimeType === "text/calendar" && message.name.endsWith(".ics")));
}

export function resolveAppUrl(value: unknown, development: boolean): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  const url = parseUrl(candidate || (development ? "http://127.0.0.1:5174" : ""));
  if (!url || url.pathname !== "/" || url.search || url.hash
    || (url.protocol !== "https:" && !(development && url.protocol === "http:"))) {
    throw new Error("Uygulama adresi gecersiz. Release icin HTTPS EXPO_PUBLIC_APP_URL gerekli.");
  }
  return url.origin;
}

export function isTrustedUrl(value: string, appUrl: string): boolean {
  const url = parseUrl(value);
  return !!url && (url.protocol === "https:" || url.protocol === "http:")
    && url.origin === appUrl;
}

export function externalUrl(value: string): string | null {
  const url = parseUrl(value);
  if (!url) return null;
  if ((url.protocol === "https:" || url.protocol === "http:") && url.hostname) return url.href;
  if (["mailto:", "geo:", "maps:", "comgooglemaps:"].includes(url.protocol)) return url.href;
  return null;
}

export function deepLinkUrl(value: string, appUrl: string): string | null {
  const url = parseUrl(value);
  if (!url || url.hash) return null;
  let path = url.pathname;
  if (url.protocol === "okumahalkasi:") {
    if (url.port) return null;
    path = "/" + [url.hostname, ...url.pathname.split("/")].filter(Boolean).join("/");
  } else if (!isTrustedUrl(value, appUrl)) return null;

  const params = new URLSearchParams(url.search);
  const route = /^\/(meeting|group)\/([A-Za-z0-9_-]{1,80})\/?$/.exec(path);
  if (route) {
    if (params.has(route[1])) return null;
    params.set(route[1], route[2]);
  } else if (path !== "/" && path !== "") return null;
  if ([...params.keys()].some((key) => key !== "meeting" && key !== "group")) return null;
  if (["meeting", "group"].some((key) => params.getAll(key).length > 1)) return null;
  const meeting = params.get("meeting");
  const group = params.get("group");
  if (meeting !== null && (!/^[1-9]\d{0,14}$/.test(meeting) || !Number.isSafeInteger(Number(meeting)))) return null;
  if (group !== null && !safeId.test(group)) return null;
  const query = params.toString();
  return appUrl + "/" + (query ? "?" + query : "");
}

export function base64ByteLength(value: string): number | null {
  if (!value.length || value.length % 4 !== 0 || value.length > Math.ceil(MAX_FILE_BYTES / 3) * 4) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const content = value.slice(0, value.length - padding);
  // Avoid a repeated-group regexp over a potentially 28 MB string.
  if (/[^A-Za-z0-9+/]/.test(content)) return null;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const last = alphabet.indexOf(content[content.length - 1]);
  if ((padding === 2 && (last & 15) !== 0) || (padding === 1 && (last & 3) !== 0)) return null;
  const size = value.length / 4 * 3 - padding;
  return size <= MAX_FILE_BYTES ? size : null;
}

export function validateBridgeRequest(raw: string, sourceUrl: string, appUrl: string): Validation {
  const invalid = (error: string, id?: string): Validation => ({ ok: false, id, error });
  if (!isTrustedUrl(sourceUrl, appUrl)) return invalid("Guvenilmeyen kaynak.");
  if (raw.length > MAX_MESSAGE_CHARS) return invalid("Dosya en fazla 20 MiB olabilir.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return invalid("Gecersiz istek."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("Gecersiz istek.");
  const message = value as Record<string, unknown>;
  const id = typeof message.id === "string" && safeId.test(message.id) ? message.id : undefined;
  if (!id) return invalid("Gecersiz istek kimligi.");
  if (message.type === "notifications:status" || message.type === "notifications:request") {
    if (Object.keys(message).some((key) => key !== "id" && key !== "type")) return invalid("Gecersiz bildirim istegi.", id);
    return { ok: true, request: { id, type: message.type } };
  }
  if (message.type === "notifications:show") {
    if (Object.keys(message).some((key) => !["id", "type", "key", "title", "body", "url"].includes(key))
      || typeof message.key !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(message.key)
      || typeof message.title !== "string" || message.title.length < 1 || message.title.length > 200
      || typeof message.body !== "string" || message.body.length > 4000
      || typeof message.url !== "string" || message.url.length > 2048
      || !isTrustedUrl(message.url, appUrl) || !deepLinkUrl(message.url, appUrl)) return invalid("Gecersiz bildirim.", id);
    return { ok: true, request: { id, type: "notifications:show", key: message.key, title: message.title, body: message.body, url: message.url } };
  }
  if (message.type === "share") {
    if (Object.keys(message).some((key) => !["id", "type", "title", "text", "url"].includes(key))
      || typeof message.title !== "string" || message.title.length > 200
      || typeof message.text !== "string" || message.text.length > 4000
      || typeof message.url !== "string" || message.url.length > 2048
      || !deepLinkUrl(message.url, appUrl) || !isTrustedUrl(message.url, appUrl)) {
      return invalid("Paylasim baglantisi gecersiz.", id);
    }
    return { ok: true, request: { id, type: "share", title: message.title, text: message.text, url: message.url } };
  }
  if (message.type === "file") {
    if (Object.keys(message).some((key) => !["id", "type", "name", "mimeType", "base64"].includes(key))
      || !validFileMetadata(message)) {
      return invalid("Yalniz ZIP ve ICS dosyalari paylasilabilir.", id);
    }
    if (typeof message.base64 !== "string" || base64ByteLength(message.base64) === null) {
      return invalid("Gecersiz dosya veya 20 MiB siniri asildi.", id);
    }
    return { ok: true, request: { id, type: "file", name: message.name, mimeType: message.mimeType, base64: message.base64 } };
  }
  if (typeof message.transferId !== "string" || !safeId.test(message.transferId)) return invalid("Gecersiz aktarim kimligi.", id);
  const transferId = message.transferId;
  if (message.type === "file:start") {
    if (Object.keys(message).some((key) => !["id", "type", "transferId", "name", "mimeType", "size"].includes(key))
      || !validFileMetadata(message) || typeof message.size !== "number" || !Number.isSafeInteger(message.size) || message.size < 1) {
      return invalid("Gecersiz dosya aktarimi.", id);
    }
    return { ok: true, request: { id, type: "file:start", transferId, name: message.name, mimeType: message.mimeType, size: message.size } };
  }
  if (message.type === "file:chunk") {
    const size = typeof message.base64 === "string" && message.base64.length <= Math.ceil(FILE_CHUNK_BYTES / 3) * 4
      ? base64ByteLength(message.base64) : null;
    if (Object.keys(message).some((key) => !["id", "type", "transferId", "offset", "base64"].includes(key))
      || typeof message.offset !== "number" || !Number.isSafeInteger(message.offset) || message.offset < 0
      || size === null || size > FILE_CHUNK_BYTES) return invalid("Gecersiz dosya parcasi.", id);
    return { ok: true, request: { id, type: "file:chunk", transferId, offset: message.offset, base64: message.base64 as string } };
  }
  if (message.type === "file:finish" || message.type === "file:cancel") {
    if (Object.keys(message).some((key) => !["id", "type", "transferId"].includes(key))) return invalid("Gecersiz aktarim istegi.", id);
    return { ok: true, request: { id, type: message.type, transferId } };
  }
  return invalid("Desteklenmeyen istek.", id);
}

export function resultScript(result: BridgeResult, appUrl: string): string {
  const detail = JSON.stringify(result).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `if(location.origin===${JSON.stringify(appUrl)}){window.dispatchEvent(new CustomEvent('okuma:native-result',{detail:${detail}}));}true;`;
}
