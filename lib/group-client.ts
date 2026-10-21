"use client";

import { useSyncExternalStore } from "react";
import type { ReadingGroup } from "@/lib/types";
import { requireOnline } from "@/lib/network-client";
export type { ReadingGroup, ReadingGroupsResponse as GroupsResponse } from "@/lib/types";

// Undefined means state has not loaded; null is the legacy, single-club API.
let readingGroup: ReadingGroup | null | undefined;
let invalidated = false;
let pendingRequests = 0;
const listeners = new Set<() => void>();

export function getReadingGroup() { return readingGroup; }
export function groupRequestPending() { return pendingRequests > 0; }
export function subscribeReadingGroup(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useReadingGroup() {
  return useSyncExternalStore(subscribeReadingGroup, getReadingGroup, () => undefined);
}

// Only application destinations survive login. URL parsing also rejects backslash redirects.
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || /[\\\u0000-\u0020]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://okuma.invalid");
    if (url.origin !== "https://okuma.invalid") return "/";
    if (url.pathname === "/groups") {
      const nested = url.searchParams.get("next");
      if (!nested || !nested.startsWith("/?")) return "/";
      return safeReturnPath(nested);
    }
    if (url.pathname !== "/") return "/";
    const params = new URLSearchParams();
    const meeting = url.searchParams.get("meeting");
    const group = url.searchParams.get("group");
    if (meeting && /^[1-9]\d*$/.test(meeting)) params.set("meeting", meeting);
    if (group && group.length <= 128) params.set("group", group);
    if (url.searchParams.get("notifications") === "1") params.set("notifications", "1");
    return "/" + (params.size ? "?" + params.toString() : "");
  } catch { return "/"; }
}

export function currentReturnPath() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname === "/"
    ? safeReturnPath(window.location.pathname + window.location.search)
    : safeReturnPath(new URLSearchParams(window.location.search).get("next"));
}

export function groupsPath(next = currentReturnPath()) {
  return "/groups?next=" + encodeURIComponent(safeReturnPath(next));
}

export function groupUrl(path: string, groupId = readingGroup?.id): string {
  if (!groupId) return path;
  const url = new URL(path, "https://okuma.invalid");
  if (url.origin !== "https://okuma.invalid") return path;
  url.searchParams.set("group", String(groupId));
  return url.pathname + url.search + url.hash;
}

export function meetingPath(id: number) { return groupUrl("/?meeting=" + id); }

function requireSelection(next: string): never {
  invalidated = true;
  window.location.replace(groupsPath(next));
  throw new Error("Okuma grubu seçimi gerekiyor.");
}

export function acceptReadingGroup(group?: ReadingGroup | null) {
  if (invalidated) throw new Error("Okuma grubu değişti. Sayfa yenileniyor.");
  const next = group ? { ...group, id: String(group.id) } : null;
  if (readingGroup !== undefined && readingGroup?.id !== next?.id) {
    requireSelection("/");
  }
  const requested = new URLSearchParams(window.location.search).get("group");
  if (next && requested && requested !== next.id) requireSelection(currentReturnPath());
  readingGroup = next;
  listeners.forEach((listener) => listener());
}

export async function groupFetch(input: string, init: RequestInit = {}): Promise<Response> {
  requireOnline();
  if (invalidated) throw new Error("Okuma grubu değişti. Sayfa yenileniyor.");
  const url = new URL(input, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
    throw new Error("Geçersiz uygulama isteği.");
  }
  const groupScoped = /^\/api\/(state|action|upload|books\/|media\/|calendar\/|groups\/(appearance|notifications))/.test(url.pathname);
  if (groupScoped && url.pathname !== "/api/state" && readingGroup === undefined) {
    throw new Error("Okuma grubu henüz yüklenmedi.");
  }
  const headers = new Headers(init.headers);
  if (groupScoped && readingGroup) headers.set("X-Reading-Group", readingGroup.id);
  pendingRequests += 1;
  try {
    const response = await fetch(input, { ...init, headers, credentials: "same-origin" }).catch(() => {
      throw new Error("Ağ isteği tamamlanamadı. Sonucu kontrol edip yeniden dene; otomatik tekrar gönderilmedi.");
    });
    if (response.status === 401) {
      invalidated = true;
      window.location.replace("/login?next=" + encodeURIComponent(currentReturnPath()));
      throw new Error("Oturum sona erdi.");
    }
    if (response.status === 409) {
      const result = await response.clone().json().catch(() => ({})) as { code?: string };
      if (result.code === "GROUP_SELECTION_REQUIRED") requireSelection(currentReturnPath());
      if (result.code === "GROUP_CHANGED") requireSelection(readingGroup ? "/" : currentReturnPath());
    }
    if (invalidated) throw new Error("Okuma grubu değişti. Sayfa yenileniyor.");
    return response;
  } finally { pendingRequests -= 1; }
}

export function finishGroupSelection(group: ReadingGroup, next: string) {
  const target = new URL(safeReturnPath(next), window.location.origin);
  const requestedGroup = target.searchParams.get("group");
  // A meeting ID only has meaning inside its original group.
  if (requestedGroup && requestedGroup !== String(group.id)) target.searchParams.delete("meeting");
  target.searchParams.set("group", String(group.id));
  invalidated = true;
  window.history.replaceState(null, "", "/groups");
  window.location.replace(target.pathname + target.search);
}
