"use client";

import { useEffect, useRef, useState } from "react";
import { getReadingGroup, groupFetch, useReadingGroup } from "@/lib/group-client";
import { RotateCcw } from "@/components/icons";

type Preference = { available: boolean; enabled: boolean; verified?: boolean; deliveryReady: boolean; queue?: Record<string, number> | null };
export function MeetingMailPreference() {
  const group = useReadingGroup();
  return group ? <ScopedMeetingMailPreference key={group.id} groupId={group.id} /> : null;
}
function ScopedMeetingMailPreference({ groupId }: { groupId: string }) {
  const [data, setData] = useState<Preference | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saving = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void groupFetch("/api/groups/notifications", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw Error();
      const result = await response.json() as Preference;
      if (!controller.signal.aborted) setData(result);
    }).catch(() => { if (!controller.signal.aborted) setError("E-posta tercihlerin yüklenemedi."); });
    return () => controller.abort();
  }, [groupId]);
  if (!data?.available && !error) return null;
  async function toggle(enabled: boolean) {
    if (saving.current || !data) return;
    saving.current = true;
    const previous = data, selectedGroup = groupId;
    setBusy(true); setError(""); setNotice(""); setData({ ...data, enabled });
    try {
      const response = await groupFetch("/api/groups/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
      const result = await response.json() as Preference & { error?: string };
      if (!response.ok) throw Error(result.error || "Tercihin kaydedilemedi.");
      if (getReadingGroup()?.id !== selectedGroup) return;
      setData((previous) => ({ ...result, queue: previous?.queue }));
      setNotice(result.deliveryReady ? "E-posta tercihin kaydedildi." : "Tercihin kaydedildi. Gönderim hizmeti açıldığında geçerli olacak.");
    } catch (cause) {
      if (getReadingGroup()?.id === selectedGroup) { setData(previous); setError((cause as Error).message); }
    } finally { saving.current = false; setBusy(false); }
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
  return <section className="meeting-mail-preference" aria-label="Buluşma e-postaları" aria-busy={busy}>
    <label><span><strong>Buluşma değişikliği e-postaları</strong><span>Tarih, saat, yer ve buluşma biçimi değişiklikleri. Yalnız bu okuma grubu için.</span></span>
      <input type="checkbox" role="switch" aria-label="Buluşma değişikliği e-postaları" checked={data?.enabled ?? false} disabled={busy || !data || (!data.verified && !data.enabled)}
        onChange={(event) => void toggle(event.target.checked)} /></label>
    {data && !data.verified && <p>E-posta almak için önce hesabındaki adresi doğrula.</p>}
    {busy && <p role="status">Kaydediliyor…</p>}
    {data && !data.deliveryReady && <p>Buluşma postalarının gönderimi henüz açılmadı. Hesap doğrulama ve şifre postaları bundan etkilenmez.</p>}
    {data?.queue && (data.deliveryReady || Object.values(data.queue).some(count => count > 0)) && <div className="meeting-mail-queue"><span>Bekleyen: {data.queue.pending || 0} · Sağlayıcıya iletilen: {data.queue.accepted || 0} · Kontrol gereken: {(data.queue.uncertain || 0) + (data.queue.failed || 0)}</span>
      {!!data.queue.pending && <button className="outline-button" type="button" disabled={busy || !data.deliveryReady} onClick={() => void retry()}><RotateCcw size={16} />Bekleyenleri işle</button>}</div>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
