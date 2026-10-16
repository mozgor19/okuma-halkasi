type NativeWindow = Window & { ReactNativeWebView?: { postMessage: (value: string) => void }; __okumaShell?: { fileStreaming?: boolean; notifications?: boolean } };
type NativeResult = { id: string; ok: boolean; error?: string; permission?: NotificationPermission };
type NativeRequest = { type: "share"; title: string; text: string; url: string }
  | { type: "file"; name: string; mimeType: string; base64: string }
  | { type: "file:start"; transferId: string; name: string; mimeType: string; size: number }
  | { type: "file:chunk"; transferId: string; offset: number; base64: string }
  | { type: "file:finish" | "file:cancel"; transferId: string }
  | { type: "notifications:status" | "notifications:request" }
  | { type: "notifications:show"; key: string; title: string; body: string; url: string };

export function isNativeApp() {
  return typeof window !== "undefined" && !!(window as NativeWindow).ReactNativeWebView;
}

function requestNative(payload: NativeRequest): Promise<NativeResult> {
  const bridge = (window as NativeWindow).ReactNativeWebView;
  if (!bridge) return Promise.reject(new Error("Uygulama bağlantısı kurulamadı."));
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const interactive = payload.type === "share" || payload.type === "file" || payload.type === "file:finish" || payload.type === "notifications:request";
    const cleanup = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("okuma:native-result", receive);
    };
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<NativeResult>).detail;
      if (detail?.id !== id) return;
      cleanup();
      if (detail.ok === true) resolve(detail);
      else reject(new Error(detail.error || "İşlem tamamlanamadı."));
    };
    const timer = interactive ? undefined : window.setTimeout(() => {
      cleanup();
      reject(new Error("İşlem zaman aşımına uğradı. Tekrar deneyebilirsin."));
    }, 120_000);
    window.addEventListener("okuma:native-result", receive);
    try { bridge.postMessage(JSON.stringify({ ...payload, id })); }
    catch (error) { cleanup(); reject(error); }
  });
}

export async function shareNative(data: { title: string; text: string; url: string }) {
  await requestNative({ type: "share", ...data });
}

export function nativeNotificationsSupported() {
  return isNativeApp() && !!(window as NativeWindow).__okumaShell?.notifications;
}

export async function nativeNotificationPermission(ask = false): Promise<NotificationPermission> {
  const result = await requestNative({ type: ask ? "notifications:request" : "notifications:status" });
  if (result.permission === "default" || result.permission === "granted" || result.permission === "denied") return result.permission;
  throw new Error("Bildirim izni okunamadı.");
}

export async function showNativeNotification(data: { key: string; title: string; body: string; url: string }) {
  await requestNative({ type: "notifications:show", ...data });
}

async function blobBase64(blob: Blob) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Dosya hazırlanamadı."));
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

export async function saveFile(blob: Blob, filename: string) {
  if (isNativeApp()) {
    const extension = filename.endsWith(".zip") ? ".zip" : ".ics";
    const name = filename.slice(0, -extension.length).slice(0, 140 - extension.length) + extension;
    const mimeType = blob.type.split(";")[0];
    if ((window as NativeWindow).__okumaShell?.fileStreaming) {
      const transferId = crypto.randomUUID();
      try {
        await requestNative({ type: "file:start", transferId, name, mimeType, size: blob.size });
        for (let offset = 0; offset < blob.size; offset += 64 * 1024) {
          const base64 = await blobBase64(blob.slice(offset, offset + 64 * 1024));
          await requestNative({ type: "file:chunk", transferId, offset, base64 });
        }
        await requestNative({ type: "file:finish", transferId });
      } catch (error) {
        await requestNative({ type: "file:cancel", transferId }).catch(() => {});
        throw error;
      }
    } else {
      if (blob.size > 20 * 1024 * 1024) throw new Error("Büyük albümleri indirmek için uygulamayı güncelle.");
      await requestNative({ type: "file", name, mimeType, base64: await blobBase64(blob) });
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
