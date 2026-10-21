"use client";

import { useEffect, useState } from "react";
import { groupFetch, useReadingGroup } from "@/lib/group-client";
import { RotateCcw } from "@/components/icons";

type Preference = { available: boolean; enabled: boolean; verified?: boolean; deliveryReady: boolean; queue?: Record<string, number> | null };
export function MeetingMailPreference() {
  const group = useReadingGroup();
  const [data, setData] = useState<Preference | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!group) return;
    const controller = new AbortController();
    void groupFetch("/api/groups/notifications", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw Error();
      const result = await response.json() as Preference;
      if (!controller.signal.aborted) setData(result);
    }).catch(() => { if (!controller.signal.aborted) setError("E-posta tercihlerin yüklenemedi."); });
    return () => controller.abort();
  }, [group]);
  if (!data?.available && !error) return null;
  async function toggle(enabled: boolean) {
    setBusy(true); setError("");
    try {
      const response = await groupFetch("/api/groups/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
      const result = await response.json() as Preference & { error?: string };
      if (!response.ok) throw Error(result.error || "Tercihin kaydedilemedi.");
      setData((previous) => ({ ...result, queue: previous?.queue }));
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function retry() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await groupFetch("/api/groups/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry" }) });
      if (!response.ok) throw Error("Bekleyen gönderimler işleme alınamadı.");
      setNotice("Bekleyen gönderimler işleme alındı. Belirsiz sonuçlar yeniden gönderilmez.");
      const updated = await groupFetch("/api/groups/notifications", { cache: "no-store" });
      if (updated.ok) setData(await updated.json());
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <section className="meeting-mail-preference" aria-label="Buluşma e-postaları">
    <label><span><strong>Buluşma değişikliği e-postaları</strong><span>Tarih, saat, yer ve buluşma biçimi değişiklikleri. Yalnız bu okuma grubu için.</span></span>
      <input type="checkbox" role="switch" aria-label="Buluşma değişikliği e-postaları" checked={data?.enabled ?? false} disabled={busy || !data || (!data.verified && !data.enabled)}
        onChange={(event) => void toggle(event.target.checked)} /></label>
    {data && !data.verified && <p>E-posta almak için önce hesabındaki adresi doğrula.</p>}
    {data && !data.deliveryReady && <p>Gönderici henüz bu ortamda etkin değil. Tercihin kaydedilir; şu anda posta gönderilmez.</p>}
    {data?.queue && <div className="meeting-mail-queue"><span>Bekleyen: {data.queue.pending || 0} · Sağlayıcıya iletilen: {data.queue.accepted || 0} · Kontrol gereken: {(data.queue.uncertain || 0) + (data.queue.failed || 0)}</span>
      {!!data.queue.pending && <button className="outline-button" type="button" disabled={busy || !data.deliveryReady} onClick={() => void retry()}><RotateCcw size={16} />Bekleyenleri işle</button>}</div>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
