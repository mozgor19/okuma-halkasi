"use client";
import type { LocalFaceScope } from "@/lib/local-face-policy";
import localWorkerUrl from "./local-face.worker?worker&url";
export type LocalFaceResult = { members?: number[]; variants?: number; candidates?: Array<{ memberId: number; score: number }>; faceCount?: number; usableReferenceCount?: number };
let worker: Worker | undefined, serial = 0;
const pending = new Map<number, { resolve: (value: LocalFaceResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
function stop() {
  worker?.terminate(); worker = undefined;
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(Error("Yerel yüz işlemi durduruldu. Tekrar deneyebilirsin.")); }
  pending.clear();
}
export function localFaceCommand(action: "list" | "enroll" | "match" | "clear", scope: LocalFaceScope, extra: { file?: File; memberId?: number; memberIds?: number[]; consent?: string } = {}) {
  if (typeof Worker === "undefined" || !globalThis.isSecureContext) return Promise.reject(Error("Bu tarayıcı güvenli yerel yüz işlemini desteklemiyor."));
  if (!worker) {
    try { worker = new Worker(new URL(localWorkerUrl, window.location.origin), { type: "module", name: "koru-local-faces" }); }
    catch { return Promise.reject(Error("Bu tarayıcı yerel yüz işçisini başlatamadı. Elle katılımcı ekleyebilirsin.")); }
    worker.onerror = () => stop();
    worker.onmessage = event => {
      const message = event.data, request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer); pending.delete(message.id);
      if (message.ok) request.resolve(message.result); else request.reject(Error(message.error || "Yerel yüz işlemi tamamlanamadı."));
    };
    window.addEventListener("pagehide", stop, { once: true });
  }
  const id = ++serial;
  return new Promise<LocalFaceResult>((resolve, reject) => {
    const timer = setTimeout(stop, 120000);
    pending.set(id, { resolve, reject, timer });
    worker!.postMessage({ id, action, scope, ...extra });
  });
}
