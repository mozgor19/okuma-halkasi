"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CalendarClock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { AppData } from "@/lib/types";

export function NotificationCenter({ data, memberId, now, onOpenMeeting }: {
  data: AppData;
  memberId: number;
  now: number;
  onOpenMeeting: (meetingId: number) => void;
}) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const notifications = useMemo(() => {
    const week = 7 * 24 * 60 * 60 * 1000;
    const fortnight = 14 * 24 * 60 * 60 * 1000;
    const items: Array<{ id: string; meetingId: number; title: string; detail: string; time: number }> = [];

    for (const meeting of data.meetings) {
      const time = new Date(meeting.date).getTime();
      const book = data.books.find((item) => item.id === meeting.bookId);
      if (!book) continue;
      const attendance = data.attendance.find((item) => item.meetingId === meeting.id && item.memberId === memberId);
      const review = data.reviews.find((item) => item.meetingId === meeting.id && item.memberId === memberId);
      if (time >= now && time - now <= week) {
        items.push({ id: `upcoming-${meeting.id}`, meetingId: meeting.id, title: book.title, detail: attendance ? "Yaklaşan buluşma" : "Yaklaşan buluşma · katılımını belirt", time });
      } else if (time < now && now - time <= fortnight && attendance && attendance.readingStatus !== "unread" && !review) {
        items.push({ id: `review-${meeting.id}`, meetingId: meeting.id, title: book.title, detail: "Puanın ve yorumun bekleniyor", time });
      }
    }
    return items.sort((left, right) => right.time - left.time);
  }, [data, memberId, now]);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").then(() => setPermission(Notification.permission));
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;
    const upcoming = notifications.find((item) => item.id.startsWith("upcoming-"));
    if (!upcoming) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `book-club-notified-${today}-${upcoming.id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    void navigator.serviceWorker.ready.then((registration) =>
      registration.showNotification("Yaklaşan kitap buluşması", {
        body: `${upcoming.title} için buluşma yaklaşıyor.`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: "/" },
      }),
    );
  }, [notifications, permission]);

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
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
        {permission === "denied" && <p className="notification-denied">Bildirim izni tarayıcı ayarlarından kapalı.</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
