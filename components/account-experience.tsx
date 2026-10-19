"use client";

import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, BookOpen, Check, RotateCcw, Trash2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { groupFetch } from "@/lib/group-client";
import { useOnline } from "@/lib/network-client";
import { TOUR_VERSION, type TourState } from "@/lib/web-experience-policy";

type Deletion = { id: string; status: "requested" | "processing" | "cancelled" | "completed"; requestedAt: number };
type Experience = { available: boolean; tourEligible?: boolean; tour?: { version: number; state: TourState } | null; deletion?: Deletion | null };
const ExperienceContext = createContext<{
  data: Experience | null; error: string; refresh(): void; replay: number; openTour(): void;
  save(body: object): Promise<void>;
}>({ data: null, error: "", refresh() {}, replay: 0, openTour() {}, async save() {} });

export function AccountExperienceProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [data, setData] = useState<Experience | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [replay, setReplay] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void groupFetch("/api/account/experience", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (controller.signal.aborted) return;
      if (response.status === 404) { setData({ available: false }); return; }
      if (!response.ok) throw new Error("Hesap araçları yüklenemedi.");
      const result = await response.json() as Experience;
      if (typeof result.available !== "boolean") throw new Error("Hesap araçları yüklenemedi.");
      if (!controller.signal.aborted) { setData(result); setError(""); }
    }).catch(() => { if (!controller.signal.aborted) setError("Hesap araçları yüklenemedi. Yeniden dene."); });
    return () => controller.abort();
  }, [enabled, revision]);
  async function save(body: object) {
    const response = await groupFetch("/api/account/experience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as Experience & { error?: string };
    if (!response.ok) throw new Error(result.error || "Hesap işlemi tamamlanamadı.");
    if ("available" in result) setData(result);
    else { const tour = body as { version: number; state: TourState }; setData((current) => current ? { ...current, tour: { version: tour.version, state: tour.state } } : current); }
  }
  return <ExperienceContext.Provider value={{ data, error, refresh, replay, openTour: () => setReplay((value) => value + 1), save }}>{children}</ExperienceContext.Provider>;
}

export function TourMenuAction() {
  const experience = useContext(ExperienceContext);
  return experience.data?.available ? <DropdownMenuItem onSelect={experience.openTour}><BookOpen /> İlk adımlar</DropdownMenuItem> : null;
}

type TourView = "home" | "roadmap" | "archive" | "profile";
export function WelcomeTour({ ready, name, groupName, planCount, meetingCount, onNavigate }: {
  ready: boolean; name: string; groupName: string; planCount: number; meetingCount: number; onNavigate(view: TourView): void;
}) {
  const experience = useContext(ExperienceContext);
  const online = useOnline();
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastReplay, setLastReplay] = useState(0);
  if (lastReplay !== experience.replay) { setLastReplay(experience.replay); setClosed(false); setStep(0); setError(""); }
  const sharedMeeting = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("meeting");
  const seen = experience.data?.tour && experience.data.tour.version >= TOUR_VERSION;
  const open = !!experience.data?.available && ready && !closed && (!!experience.data.tourEligible && !seen && !sharedMeeting || experience.replay > 0);
  const steps = [
    { title: "Okuma grubun", detail: groupName, command: "Planı aç", view: "roadmap" as const },
    { title: "Okuma planın", detail: `${planCount} kitap`, command: "Buluşmaları aç", view: "archive" as const },
    { title: "Buluşmaların", detail: `${meetingCount} buluşma`, command: "Profilimi aç", view: "profile" as const },
    { title: "Profilin", detail: name, command: "Tamamla", view: "home" as const },
  ];
  const current = steps[step];
  async function finish(state: TourState) {
    setBusy(true); setError("");
    try { await experience.save({ kind: "tour", version: TOUR_VERSION, state }); setClosed(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Tercihin kaydedilemedi."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(value) => { if (!value && !busy) { setClosed(true); void experience.save({ kind: "tour", version: TOUR_VERSION, state: "dismissed" }).catch(() => {}); } }}>
    <DialogContent className="experience-dialog" showCloseButton={false}>
      <DialogHeader><span className="eyebrow">İLK ADIMLAR · {step + 1} / {steps.length}</span><DialogTitle>{current.title}</DialogTitle><DialogDescription>{current.detail}</DialogDescription></DialogHeader>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="experience-commands">
        <Button type="button" variant="outline" disabled={busy} onClick={() => { if (!online) { setClosed(true); return; } void finish("dismissed"); }}>Daha sonra</Button>
        <Button type="button" disabled={busy || !online} onClick={() => {
          if (step === steps.length - 1) { void finish("completed"); return; }
          onNavigate(current.view); setStep((value) => value + 1);
        }}>{step === steps.length - 1 ? <Check size={18} /> : <ArrowRight size={18} />}{busy ? "Kaydediliyor" : current.command}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

export function AccountDataRequests() {
  const experience = useContext(ExperienceContext);
  const online = useOnline();
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = experience.data?.deletion;
  const pending = request?.status === "requested" || request?.status === "processing";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await experience.save({ kind: "deletion", action: pending ? "cancel" : "request", password, confirmed });
      setPassword(""); setConfirmed(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Talep kaydedilemedi."); }
    finally { setBusy(false); }
  }
  return <section className="profile-section account-data-section" aria-label="Hesap ve veriler">
    <div className="profile-section-heading"><span className="eyebrow">HESAP VE VERİLER</span><h2>Silme talebi</h2>
      <p>Hesabın ve tüm gruplardaki kişisel verilerin için başvuru. Talep göndermek hesabını hemen silmez; ortak kayıtlar ve grup yöneticiliği destek tarafından değerlendirilir.</p>
      <a className="small-link" href="mailto:koru.destek@gmail.com">koru.destek@gmail.com</a>
    </div>
    <div className="account-data-content">
      {experience.error ? <><p role="alert">{experience.error}</p><Button variant="outline" onClick={experience.refresh}><RotateCcw size={17} /> Yeniden dene</Button></> : !experience.data ? <p role="status">Yükleniyor.</p> : !experience.data.available ? <p>Uygulama içi başvuru henüz açılmadı. Kayıtlı e-postanla destek adresine başvurabilirsin; şifreni e-postayla gönderme.</p> : <>
        {request && <div className="data-request-status" role="status"><strong>{request.status === "requested" ? "Talebin alındı" : request.status === "processing" ? "Talebin inceleniyor" : request.status === "cancelled" ? "Talebin iptal edildi" : "Talebin sonuçlandı"}</strong><span>Başvuru: {request.id}</span>{pending && <p>Hesabın henüz silinmedi. Durum bilgisi için destekle bu başvuru numarasını paylaşabilirsin.</p>}</div>}
        {request?.status !== "processing" && request?.status !== "completed" && <form className="account-data-form" onSubmit={submit} aria-busy={busy}>
          <label>Mevcut şifre<Input type="password" autoComplete="current-password" required maxLength={200} value={password} disabled={busy || !online} onChange={(event) => setPassword(event.target.value)} /></label>
          {!pending && <label className="onboarding-consent"><input type="checkbox" required checked={confirmed} disabled={busy || !online} onChange={(event) => setConfirmed(event.target.checked)} /><span>Hesabım ve tüm gruplardaki kişisel verilerim için silme talebi gönderiyorum.</span></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" variant="outline" disabled={busy || !online}><Trash2 size={17} />{busy ? "İşleniyor" : pending ? "Silme talebini iptal et" : "Silme talebi gönder"}</Button>
        </form>}
      </>}
    </div>
  </section>;
}
