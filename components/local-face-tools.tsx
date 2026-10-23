"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ShieldCheck, ImagePlus, Trash2, ScanFace } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { localFaceCommand } from "@/lib/local-face-client";
import { LOCAL_FACE_CONSENT, type LocalFaceScope } from "@/lib/local-face-policy";
import { isAdminRole, type AppData, type Member } from "@/lib/types";
const Suggestions = dynamic(() => import("@/components/attendance-suggestion-dialog").then(module => module.AttendanceSuggestionDialog));
const scopeFor = (data: AppData, member: Member): LocalFaceScope => ({ groupId: data.readingGroup?.id || "default", ownerId: member.id });

export function LocalFaceReferences({ data, member, onNotice, onClearLegacy }: { data: AppData; member: Member; onNotice: (message: string) => void; onClearLegacy: () => Promise<boolean> }) {
  const [members, setMembers] = useState<number[]>([]), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const scope = scopeFor(data, member);
  useEffect(() => {
    let cancelled = false;
    void localFaceCommand("list", { groupId: scope.groupId, ownerId: scope.ownerId }).then(result => { if (!cancelled) setMembers(result.members || []); })
      .catch(() => { if (!cancelled) setError("Yerel yüz kasası açılamadı. Bu tarayıcıda elle katılımcı ekleyebilirsin."); });
    return () => { cancelled = true; };
  }, [scope.groupId, scope.ownerId]);
  const visible = data.members.filter(person => !person.isGuest && (isAdminRole(member.role) || person.id === member.id));
  async function clear(memberId?: number) {
    setBusy(true); setError("");
    try { const result = await localFaceCommand("clear", scope, { memberId }); setMembers(result.members || []); onNotice("Bu gruba ait seçilen yerel yüz verileri silindi."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Yerel kayıt silinemedi."); }
    finally { setBusy(false); }
  }
  return <section className="profile-section face-reference-section local-face-tools" aria-label="Yerel yüz referansları" aria-busy={busy}>
    <div className="profile-section-heading"><span className="eyebrow">YÜZ VERİSİ</span><h2>Bu cihazdaki yüz referansları</h2>
      <p>Fotoğraf ve yüz vektörleri sunucuya gönderilmez. Ham referans saklanmaz; yüz vektörleri bu tarayıcıda şifreli tutulur ve 30 gün sonra geçersizleşir. Başka cihazlara aktarılmaz.</p></div>
    <span className="local-processing"><ShieldCheck size={17} /> Yalnız bu tarayıcı</span>
    <label className="onboarding-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} /><span>Referansı eklenecek kişinin bu cihazda yüz eşleştirmesine açık izni var; <a href="/privacy" target="_blank" rel="noreferrer">yerel veri ve silme bilgisini</a> okudum.</span></label>
    <div className="face-reference-grid">{visible.map(person => <div className="face-reference-row" key={person.id}>
      <span className="face-reference-preview"><ScanFace size={24} /></span>
      <span className="face-reference-person"><strong>{person.name}</strong><small>{members.includes(person.id) ? "Bu cihazda kayıtlı" : "Bu cihazda referans yok"}</small></span>
      <label className={`face-reference-upload ${busy || !consent ? "disabled" : ""}`}><ImagePlus size={16} />{members.includes(person.id) ? "Değiştir" : "Ekle"}
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !consent} onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ""; if (!file || !consent || busy) return;
          setBusy(true); setError("");
          try {
            const result = await localFaceCommand("enroll", scope, { file, memberId: person.id, consent: LOCAL_FACE_CONSENT });
            setMembers(result.members || []); onNotice("Referans yalnız bu tarayıcıda kaydedildi. Tek fotoğraftan " + result.variants + " aydınlatma örneği hazırlandı.");
          } catch (cause) { setError(cause instanceof Error ? cause.message : "Yerel referans hazırlanamadı."); }
          finally { setBusy(false); }
        }} /></label>
      {members.includes(person.id) && <Button type="button" variant="ghost" size="icon" title={person.name + " için yerel referansı sil"} aria-label={person.name + " için yerel referansı sil"} disabled={busy} onClick={() => void clear(person.id)}><Trash2 size={17} /></Button>}
    </div>)}</div>
    <div className="local-face-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => void clear()}><Trash2 size={17} />Bu grubun yerel referanslarını sil</Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { if (await onClearLegacy()) onNotice("Sunucudaki eski yüz referansın silindi. Bu cihazdaki kayıtlar bundan bağımsızdır."); }
        catch { setError("Eski sunucu kaydı silinemedi. Yeniden deneyebilirsin."); }
        finally { setBusy(false); }
      }}>Sunucudaki eski yüz verimi sil</Button></div>
    {busy && <p role="status">İşlem bu cihazda sürüyor. İlk kullanımda model dosyaları indirilebilir.</p>}
    {error && <p role="alert">{error}</p>}
    <p className="muted">Çıkış yapmak yerel kasayı silmez. Paylaşılan cihazda işiniz bitince yerel referansları silin. Otomatik eşleştirme hatalı olabilir; bu özellik kimlik doğrulama için kullanılmaz.</p>
  </section>;
}

export function LocalFaceAttendance({ data, member, meetingId, onAdd, onNotice }: { data: AppData; member: Member; meetingId: number; onAdd: (id: number) => Promise<boolean>; onNotice: (message: string) => void }) {
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<{ candidates: Array<{ memberId: number; name: string; score: number }>; faceCount: number } | null>(null);
  return <section className="local-face-tools local-face-attendance" aria-label="Cihazda katılımcı eşleştir" aria-busy={busy}>
    <div className="section-row"><div><span className="eyebrow">YEREL EŞLEŞTİRME</span><h2>Fotoğraftan katılımcı öner</h2></div><ShieldCheck size={22} /></div>
    <p>Bu fotoğraf galeriye eklenmez veya sunucuya gönderilmez. Yalnız bu tarayıcıdaki referanslarla karşılaştırılır; önerileri sen onaylarsın.</p>
    <label className="onboarding-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>Fotoğraftakilerin bu yerel eşleştirmeye izni var.</span></label>
    <label className={`upload-button ${busy || !consent ? "disabled" : ""}`}><ScanFace size={17} />{busy ? "Bu cihazda inceleniyor" : "Yerel analiz için fotoğraf seç"}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !consent} onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ""; if (!file || !consent || busy) return;
        setBusy(true); setError("");
        try {
          const result = await localFaceCommand("match", scopeFor(data, member), { file, consent: LOCAL_FACE_CONSENT, memberIds: data.members.filter(person => !person.isGuest).map(person => person.id) });
          if (!result.usableReferenceCount) throw Error("Bu tarayıcıda bu gruba ait kullanılabilir referans yok. Profil > Yüz verisi bölümünden ekle.");
          const candidates = (result.candidates || []).flatMap(candidate => {
            const person = data.members.find(person => person.id === candidate.memberId && !person.isGuest);
            return person ? [{ ...candidate, name: person.name }] : [];
          });
          if (!candidates.length) throw Error("Net bir eşleşme bulunamadı. Daha aydınlık ve yüzlerin daha büyük olduğu bir fotoğraf dene veya katılımcıları elle ekle.");
          setSuggestion({ candidates, faceCount: result.faceCount || 0 });
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Yerel eşleştirme tamamlanamadı."); }
        finally { setBusy(false); }
      }} /></label>
    {busy && <p role="status">Model ve yüz analizi arka planda çalışıyor. Fotoğraf dışarı gönderilmiyor.</p>}
    {error && <p role="alert">{error}</p>}
    {suggestion && <Suggestions open meetingId={meetingId} candidates={suggestion.candidates} faceCount={suggestion.faceCount} members={data.members}
      alreadyAttending={new Set(data.attendance.filter(row => row.meetingId === meetingId).map(row => row.memberId))} busy={busy}
      onOpenChange={open => { if (!open) setSuggestion(null); }} onConfirm={async ids => {
        setBusy(true);
        try { for (const id of ids) if (!await onAdd(id)) return false; onNotice("Onayladığın katılımcılar eklendi. Yüz fotoğrafı, vektörü veya eşleşme puanı gönderilmedi."); return true; }
        finally { setBusy(false); }
      }} />}
  </section>;
}
