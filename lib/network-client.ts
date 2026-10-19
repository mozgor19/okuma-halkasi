"use client";

import { useSyncExternalStore } from "react";

export const OFFLINE_MESSAGE = "Bağlantı yok. Değişiklik kaydedilmedi; bağlantı geldiğinde yeniden dene.";

export function browserOnline() { return typeof navigator === "undefined" || navigator.onLine !== false; }
function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
}
export function useOnline() { return useSyncExternalStore(subscribe, browserOnline, () => true); }
export function requireOnline() { if (!browserOnline()) throw new Error(OFFLINE_MESSAGE); }
