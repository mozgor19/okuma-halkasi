import { env } from "cloudflare:workers";
import { publicHttpsOrigin } from "@/lib/onboarding-policy";
import type { MeetingKind } from "@/lib/meeting-details";

type Snapshot = { date: string; location: string; kind: MeetingKind; mapUrl: string | null; onlineUrl: string | null };
export type MeetingMailChange = { before: Snapshot; after: Snapshot };
export class MeetingMailDeferred extends Error {
  constructor(readonly retryAfter: number) { super("MEETING_MAIL_RATE_LIMITED"); }
}
export function meetingMailConfiguration() {
  const origin = publicHttpsOrigin(env.AUTH_PUBLIC_ORIGIN || "");
  const from = env.MEETING_MAIL_FROM;
  if (env.MEETING_MAIL_ENABLED !== "true" || origin !== "https://birkoru.com" || !env.MEETING_MAIL_API_KEY
    || !from || !/^[a-z0-9._+-]+@birkoru\.com$/.test(from)) return null;
  return { origin, from, apiKey: env.MEETING_MAIL_API_KEY };
}
const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
const when = (value: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(value + ":00+03:00"));
export function meetingChangeMail({ origin, group, meetingId, title, change }: {
  origin: string; group: { id: string; name: string }; meetingId: number; title: string; change: MeetingMailChange;
}) {
  const meeting = new URL("/", origin); meeting.searchParams.set("meeting", String(meetingId)); meeting.searchParams.set("group", group.id);
  const calendar = new URL(`/api/calendar/${meetingId}`, origin); calendar.searchParams.set("group", group.id);
  const settings = new URL("/?notifications=1", origin); settings.searchParams.set("group", group.id);
  const describe = (item: Snapshot) => `${when(item.date)}\n${item.kind === "online" ? "Çevrim içi" : "Yüz yüze"}: ${item.kind === "online" ? item.onlineUrl || "Bağlantı henüz eklenmedi" : item.location + (item.mapUrl ? "\nHarita: " + item.mapUrl : "")}`;
  const subject = "Koru: buluşma bilgileri güncellendi";
  const text = `${group.name}\n${title}\n\nÖnceki bilgiler\n${describe(change.before)}\n\nGüncel bilgiler\n${describe(change.after)}\n\nBuluşmayı aç: ${meeting.href}\nGüncel takvim kaydı: ${calendar.href}\n\nTakvimindeki eski kayıt kendiliğinden değişmez. Takvim uygulamana göre güncel dosyayı içe aktar veya mevcut kaydı düzenle.\n\nE-posta tercihlerin: ${settings.href}\nDestek: koru.destek@gmail.com`;
  const html = `<html lang="tr"><body style="margin:0;background:#fffdf7;color:#172d45;font:16px/1.6 Georgia,serif"><main style="max-width:600px;margin:auto;padding:28px"><h1 style="font:700 26px/1.2 Arial,sans-serif">Koru</h1><h2 style="font:600 22px/1.3 Arial,sans-serif">Buluşma bilgileri güncellendi</h2><p>${escape(group.name)}<br><strong>${escape(title)}</strong></p><h3>Önceki bilgiler</h3><p>${escape(describe(change.before)).replaceAll("\n", "<br>")}</p><h3>Güncel bilgiler</h3><p>${escape(describe(change.after)).replaceAll("\n", "<br>")}</p><p><a style="color:#1f5874" href="${escape(meeting.href)}">Buluşmayı aç</a></p><p><a style="color:#1f5874" href="${escape(calendar.href)}">Güncel takvim kaydını indir</a></p><p>Takvimindeki eski kayıt kendiliğinden değişmez. Takvim uygulamana göre güncel dosyayı içe aktar veya mevcut kaydı düzenle.</p><hr><p><a style="color:#1f5874" href="${escape(settings.href)}">E-posta tercihlerin</a> · <a style="color:#1f5874" href="mailto:koru.destek@gmail.com">Destek</a></p></main></body></html>`;
  return { subject, text, html };
}

export async function sendMeetingMailBatch(mails: Array<{ recipient: string; subject: string; text: string; html: string }>, key: string) {
  const config = meetingMailConfiguration();
  if (!config || mails.length < 1 || mails.length > 100) throw Error("MEETING_MAIL_NOT_READY");
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: { Authorization: "Bearer " + config.apiKey, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(mails.map((mail) => ({ from: `Koru <${config.from}>`, to: [mail.recipient], reply_to: "koru.destek@gmail.com",
      subject: mail.subject, text: mail.text, html: mail.html }))),
  });
  if (response.status === 429) {
    const seconds = Number(response.headers.get("Retry-After"));
    await response.body?.cancel();
    throw new MeetingMailDeferred(Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.min(20 * 3600, Math.max(60, seconds)) : 3600) * 1000);
  }
  // A timeout or rejection is not proof that a message was not accepted.
  // Persist uncertainty; never automatically resend an ambiguous batch.
  if (!response.ok) { await response.body?.cancel(); throw Error("MEETING_MAIL_PROVIDER_UNCERTAIN"); }
  const result = await response.json() as { data?: Array<{ id?: string }> };
  if (!Array.isArray(result.data) || result.data.length !== mails.length || result.data.some((item) => !item || typeof item.id !== "string" || !item.id)) {
    throw Error("MEETING_MAIL_PROVIDER_UNCERTAIN");
  }
}
