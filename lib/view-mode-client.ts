"use client";

import { useSyncExternalStore } from "react";

const key = "kitapTahlilViewMode";
const event = "okuma:view-mode";
type ViewMode = "admin" | "member";
let fallback: ViewMode = "admin";
function read(): ViewMode {
  try { return window.localStorage.getItem(key) === "member" ? "member" : "admin"; }
  catch { return fallback; }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(event, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(event, listener); };
}
export function useViewMode() { return useSyncExternalStore(subscribe, read, (): ViewMode => "admin"); }
export function saveViewMode(mode: ViewMode) {
  fallback = mode;
  try { window.localStorage.setItem(key, mode); } catch { /* The current tab still works without persistent storage. */ }
  window.dispatchEvent(new Event(event));
}
