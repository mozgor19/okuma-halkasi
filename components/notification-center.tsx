"use client";

import { nextDeviceNotification } from "@/lib/notification-policy";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, CalendarClock } from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { AppData } from "@/lib/types";
import { groupUrl, useReadingGroup } from "@/lib/group-client";
import { isNativeApp, nativeNotificationPermission, nativeNotificationsSupported, showNativeNotification } from "@/lib/native-bridge";
import { useKoruBrand } from "@/components/group-branding";
import { KORU_BRAND } from "@/lib/brand-identity";

export function NotificationCenter({ data, memberId, now, onOpenMeeting }: {
  data: AppData;
  memberId: number;
  now: number;
  onOpenMeeting: (meetingId: number) => void;
}) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [native, setNative] = useState(false);
  const [error, setError] = useState("");
  const group = useReadingGroup();
  const koru = useKoruBrand();
  const delivered = useRef(new Set<string>());
  const pending = useRef(new Set<string>());
  const notifications = useMemo(() => {
    const week = 7 * 24 * 60 * 60 * 1000;
    const fortnight = 14 * 24 * 60 * 60 * 1000;
    const recentMeetingWindow = 14 * 24 * 60 * 60 * 1000;
    const items: Array<{ id: string; meetingId: number; title: string; detail: string; time: number }> = [];

    for (const change of data.meetingChanges ?? []) {
      const meeting = data.meetings.find((item) => item.id === change.meetingId);
      const book = meeting && data.books.find((item) => item.id === meeting.bookId);
      if (book) items.push({ id: `changed-${change.id}`, meetingId: change.meetingId, title: book.title,
        detail: "Buluşma bilgileri değişti · takvim kaydını kontrol et", time: change.createdAt });
    }

    for (const meeting of data.meetings) {
      const time = new Date(meeting.date).getTime();
      const book = data.books.find((item) => item.id === meeting.bookId);
      if (!book) continue;
      const attendance = data.attendance.find((item) => item.meetingId === meeting.id && item.memberId === memberId);
      const review = data.reviews.find((item) => item.meetingId === meeting.id && item.memberId === memberId);
      const rsvp = data.meetingRsvps.some((item) => item.meetingId === meeting.id && item.memberId === memberId);
      const createdAt = Date.parse((meeting.createdAt || "").replace(" ", "T") + "Z");
      const meetingDayEnds = new Date(meeting.date.slice(0, 10) + "T23:59:59+03:00").getTime();
      if (meeting.createdBy !== memberId && meetingDayEnds >= now && Number.isFinite(createdAt) && now - createdAt <= recentMeetingWindow) {
        items.push({ id: `new-${meeting.id}`, meetingId: meeting.id, title: book.title, detail: rsvp ? "Yeni buluşma oluşturuldu · geliyorsun" : "Yeni buluşma oluşturuldu · geliyor musun?", time: createdAt });
      } else if (time >= now && time - now <= week) {
        items.push({ id: `upcoming-${meeting.id}`, meetingId: meeting.id, title: book.title, detail: rsvp ? "Yaklaşan buluşma · geliyorsun" : "Yaklaşan buluşma · geliyor musun?", time });
      } else if (time < now && now - time <= fortnight && attendance && attendance.readingStatus !== "unread" && !review) {
        items.push({ id: `review-${meeting.id}`, meetingId: meeting.id, title: book.title, detail: "Puanın ve yorumun bekleniyor", time });
      }
    }
    return items.sort((left, right) => right.time - left.time);
  }, [data, memberId, now]);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const update = () => {
      if (!isNativeApp()) return;
      setNative(true);
      if (!nativeNotificationsSupported()) return;
      const current = ++revision;
      void nativeNotificationPermission().then((value) => { if (active && current === revision) { setPermission(value); if (value === "granted") setError(""); } })
        .catch(() => { if (active && current === revision) setError("Cihaz bildirim izni okunamadı."); });
    };
    // Native injection may finish after the React effect has mounted.
    window.addEventListener("okuma:native-ready", update);
    window.addEventListener("okuma:resume", update);
    if (isNativeApp()) update();
    else if ("Notification" in window && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(koru ? "/koru-sw.js" : "/sw.js")
        .then(() => { if (active && !isNativeApp()) setPermission(Notification.permission); })
        .catch(() => { if (active && !isNativeApp()) setError("Cihaz bildirimleri başlatılamadı."); });
    }
    return () => {
      active = false;
      window.removeEventListener("okuma:native-ready", update);
      window.removeEventListener("okuma:resume", update);
    };
  }, [koru]);

  useEffect(() => {
    if (permission !== "granted" || !memberId || group === undefined) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = nextDeviceNotification(notifications, group?.id ?? "legacy", memberId, today, (key) => {
      if (delivered.current.has(key) || pending.current.has(key)) return true;
      try { return !!localStorage.getItem(key); } catch { return false; }
    });
    if (!next) return;
    const { notification, key } = next;
    pending.current.add(key);
    let active = true;
    const title = notification.id.startsWith("changed-") ? "Buluşma bilgileri güncellendi" : notification.id.startsWith("new-") ? "Yeni kitap buluşması" : "Yaklaşan kitap buluşması";
    const body = notification.id.startsWith("changed-") ? `${notification.title}: tarih, yer veya buluşma biçimi değişti. Takvim kaydını kontrol et.` : notification.id.startsWith("new-") ? `${notification.title} için yeni buluşma oluşturuldu.` : `${notification.title} için buluşma yaklaşıyor.`;
    const url = groupUrl(`/?meeting=${notification.meetingId}`, group?.id);
    void (async () => {
      if (!active) return;
      if (isNativeApp()) {
        await showNativeNotification({ key, title, body, url: new URL(url, window.location.origin).toString() });
      } else {
        const registration = await navigator.serviceWorker.ready;
        if (!active) return;
        await registration.showNotification(title, {
          body,
          icon: koru ? KORU_BRAND.icon192 : "/icons/notebook-icon-192.png",
          badge: koru ? KORU_BRAND.badge : "/icons/notebook-icon-192.png",
          tag: key,
          data: { url },
        });
      }
      delivered.current.add(key);
      try { localStorage.setItem(key, "1"); } catch { /* Notification delivery does not depend on storage. */ }
    })().catch(() => { if (active) setError("Cihaz bildirimi gösterilemedi."); })
      .finally(() => { pending.current.delete(key); });
    return () => { active = false; };
  }, [group, koru, memberId, notifications, permission]);

  async function enableNotifications() {
    try {
      if (!isNativeApp() && !("Notification" in window)) return;
      const result = isNativeApp() ? await nativeNotificationPermission(true) : await Notification.requestPermission();
      setPermission(result);
      setError(isNativeApp() && result !== "granted" ? "Bildirim izni verilmedi." : "");
    } catch { setError("Bildirim izni alınamadı."); }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="topbar-tool" aria-label="Bildirimler" title="Bildirimler">
          <Bell size={18} />
          {notifications.length > 0 && <span>{Math.min(notifications.length, 9)}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="notification-menu">
        <div className="notification-heading">
          <strong>Bildirimler</strong>
          <small>{notifications.length ? `${notifications.length} kayıt` : "Yeni bildirim yok"}</small>
        </div>
        {notifications.map((item) => (
          <button type="button" className="notification-item" key={item.id} onClick={() => onOpenMeeting(item.meetingId)}>
            <CalendarClock size={18} />
            <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          </button>
        ))}
        {!notifications.length && <div className="notification-empty">Şimdilik her şey tamam.</div>}
        {permission === "default" && (
          <button type="button" className="notification-permission" onClick={() => void enableNotifications()}>
            <BellRing size={16} /> Cihaz bildirimlerini aç
          </button>
        )}
        {permission === "denied" && <p className="notification-denied">Bildirim izni {native ? "cihaz" : "tarayıcı"} ayarlarından kapalı.</p>}
        {error && <p className="notification-denied" role="alert">{error}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
