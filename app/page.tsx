"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowRight, BookOpen, CalendarDays, Camera, Check, ChevronRight, Compass, ExternalLink, ImagePlus, LogOut, MapPin, Plus, Search, Star, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { demoData } from "@/lib/demo";
import { type AppData, type Book, type Meeting, type Member, type Attendance, readingLabels } from "@/lib/types";

type View = "home" | "archive" | "roadmap" | "meeting";
type Lookup = { title: string; author: string; publisher: string | null; pages: number | null; isbn: string | null; coverUrl: string | null; sourceUrl: string | null };
const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("tr-TR", { weekday: "long" });
const readableDate = (value: string) => dateFormat.format(new Date(value));
const firstName = (name: string) => name.split(" ")[0];
const initials = (name: string) => name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
const validMap = (url: string | null) => url && /^https:\/\//i.test(url) ? url : null;

async function readyImage(file: File): Promise<File> {
  if (file.size <= 650_000) return file;
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Fotoğraf işlenemedi.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Fotoğraf işlenemedi.")), "image/jpeg", quality));
    let result = await encode(.76);
    if (result.size > 750_000) {
      const reduced = document.createElement("canvas"); reduced.width = Math.round(canvas.width * .75); reduced.height = Math.round(canvas.height * .75);
      const reducedContext = reduced.getContext("2d");
      if (!reducedContext) throw new Error("Fotoğraf işlenemedi.");
      reducedContext.drawImage(canvas, 0, 0, reduced.width, reduced.height);
      result = await new Promise<Blob>((resolve, reject) => reduced.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Fotoğraf işlenemedi.")), "image/jpeg", .7));
    }
    return new File([result], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally { image.close(); }
}

function Avatar({ member, size = "normal" }: { member: Member; size?: "normal" | "small" }) {
  return <span className={`avatar ${size === "small" ? "avatar-small" : ""}`} style={{ backgroundColor: member.color }} title={member.name} aria-label={member.name}>{initials(member.name)}</span>;
}
function BookCover({ book, small = false }: { book: Book; small?: boolean }) {
  return <div className={`book-cover ${small ? "cover-small" : ""}`}>
    {book.coverUrl ? <img src={book.coverUrl} alt={`${book.title} kapağı`} /> : <div className="cover-placeholder"><span className="cover-ornament">✦</span><span className="cover-title">{book.title}</span><span className="cover-author">{book.author}</span></div>}
  </div>;
}

export default function Home() {
  const [data, setData] = useState<AppData>(demoData);
  const [memberId, setMemberId] = useState(1);
  const [view, setView] = useState<View>("home");
  const [meetingId, setMeetingId] = useState<number | null>(null);
  const [createMode, setCreateMode] = useState<"meeting" | "plan" | null>(null);
  const [scheduledPlanId, setScheduledPlanId] = useState<number | null>(null);
  const [editMeetingOpen, setEditMeetingOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoFallback, setDemoFallback] = useState(false);
  const [status, setStatus] = useState<Attendance["readingStatus"]>("read");
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [assignMember, setAssignMember] = useState("");

  async function reload() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Buluşma kayıtları yüklenemedi.");
    const updated = await response.json() as AppData;
    if (!updated.members?.length) {
      setData(demoData); setDemoFallback(true);
      return demoData;
    }
    setData(updated); setDemoFallback(false);
    return updated;
  }
  useEffect(() => {
    const saved = Number(window.sessionStorage.getItem("okuma-demo-persona"));
    if (saved >= 1 && saved <= 6) setMemberId(saved);
    void reload().catch(() => { setDemoFallback(true); });
  }, []);

  const member = data.members.find((person) => person.id === memberId) ?? data.members[0];
  const sortedMeetings = useMemo(() => [...data.meetings].sort((a, b) => b.date.localeCompare(a.date)), [data.meetings]);
  const featured = sortedMeetings[0];
  const selectedMeeting = data.meetings.find((meeting) => meeting.id === meetingId) ?? featured;
  const findBook = (id: number) => data.books.find((book) => book.id === id);
  const featuredBook = featured && findBook(featured.bookId);
  const activeBook = selectedMeeting && findBook(selectedMeeting.bookId);
  const attendees = selectedMeeting ? data.attendance.filter((item) => item.meetingId === selectedMeeting.id) : [];
  const reviews = selectedMeeting ? data.reviews.filter((item) => item.meetingId === selectedMeeting.id) : [];
  const pictures = selectedMeeting ? data.photos.filter((item) => item.meetingId === selectedMeeting.id) : [];
  const myAttendance = attendees.find((item) => item.memberId === memberId);
  const myReview = reviews.find((item) => item.memberId === memberId);
  const avgRating = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1).replace(".", ",") : "—";

  useEffect(() => {
    if (!selectedMeeting) return;
    const existingAttendance = data.attendance.find((entry) => entry.meetingId === selectedMeeting.id && entry.memberId === memberId);
    const existingReview = data.reviews.find((entry) => entry.meetingId === selectedMeeting.id && entry.memberId === memberId);
    setStatus(existingAttendance?.readingStatus === "unselected" ? "read" : existingAttendance?.readingStatus ?? "read");
    setRating(existingReview?.rating ?? null);
    setComment(existingReview?.comment ?? "");
  }, [selectedMeeting?.id, memberId, data.attendance, data.reviews]);

  async function perform(action: string, payload: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, memberId, ...payload }) });
      const result = await response.json() as { error?: string; meetingId?: number; ok?: boolean };
      if (!response.ok) throw new Error(result.error || "İşlem kaydedilemedi.");
      await reload();
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "İşlem kaydedilemedi.");
      return null;
    } finally { setBusy(false); }
  }
  function openMeeting(id: number) { setMeetingId(id); setView("meeting"); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function navigate(next: View) { setView(next); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function selectMember(id: number) { setMemberId(id); window.sessionStorage.setItem("okuma-demo-persona", String(id)); setError(""); }
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  async function upload(file: File, purpose: "photo" | "cover", currentMeeting?: number) {
    if (file.size > 8 * 1024 * 1024) { setError("Fotoğraf en fazla 8 MB olabilir."); return null; }
    setBusy(true); setError("");
    try {
      const prepared = await readyImage(file);
      const body = new FormData(); body.set("file", prepared); body.set("memberId", String(memberId)); body.set("purpose", purpose);
      if (currentMeeting) body.set("meetingId", String(currentMeeting));
      const response = await fetch("/api/upload", { method: "POST", body });
      const result = await response.json().catch(() => ({ error: "Görsel gönderilemedi; daha küçük bir fotoğraf dene." })) as { error?: string; url?: string };
      if (!response.ok) throw new Error(result.error || "Görsel yüklenemedi.");
      if (purpose === "photo") await reload();
      return result.url ?? null;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Görsel yüklenemedi."); return null; }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => navigate("home")}><span className="brand-emblem"><BookOpen size={25} strokeWidth={1.65} /></span><span>okuma<span className="brand-accent">halkası</span><small>kitap kulübü</small></span></button>
      <p className="nav-label">KEŞFET</p>
      <nav className="side-nav" aria-label="Ana menü">
        <button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}><BookOpen size={19} /> Haftanın kitabı</button>
        <button className={view === "archive" || view === "meeting" ? "active" : ""} onClick={() => navigate("archive")}><Archive size={19} /> Buluşma arşivi</button>
        <button className={view === "roadmap" ? "active" : ""} onClick={() => navigate("roadmap")}><Compass size={19} /> Gelecek kitaplar</button>
      </nav>
      <div className="sidebar-bottom"><div className="tiny-rule" /><p>ÜYELER</p><div className="avatar-stack">{data.members.map((person) => <Avatar member={person} size="small" key={person.id} />)}</div><span className="sidebar-caption">{data.members.length} kayıtlı üye</span></div>
    </aside>

    <div className="main-area">
      <header className="topbar"><div className="mobile-brand"><BookOpen size={21} /> okuma<span>halkası</span></div><div className="breadcrumb">OKUMA HALKASI <ChevronRight size={14} /> <strong>{view === "home" ? "Haftanın kitabı" : view === "roadmap" ? "Gelecek kitaplar" : view === "archive" ? "Buluşma arşivi" : "Kitap defteri"}</strong></div><div className="topbar-actions"><span className="preview-pill">TASARIM ÖNİZLEMESİ</span><label className="person-picker"><Avatar member={member} size="small" /><select value={memberId} onChange={(event) => selectMember(Number(event.target.value))} aria-label="Önizleme hesabı seç">{data.members.map((person) => <option key={person.id} value={person.id}>{person.name}{person.role === "admin" ? " · yönetici" : ""}</option>)}</select></label><button type="button" className="logout-button" onClick={() => void signOut()} aria-label="Çıkış yap" title="Çıkış yap"><LogOut size={17} /></button></div></header>
      <div className="mobile-nav" aria-label="Mobil menü"><button onClick={() => navigate("home")} className={view === "home" ? "active" : ""}><BookOpen size={18} /> Kitap</button><button onClick={() => navigate("archive")} className={view === "archive" || view === "meeting" ? "active" : ""}><Archive size={18} /> Arşiv</button><button onClick={() => navigate("roadmap")} className={view === "roadmap" ? "active" : ""}><Compass size={18} /> Plan</button></div>
      {demoFallback && <div className="preview-notice" role="status">Örnek kayıtlar gösteriliyor. Yerel veritabanı hazır olduğunda kayıt işlemleri açılır.</div>}
      {error && <div className="error-banner" role="alert">{error}<button aria-label="Uyarıyı kapat" onClick={() => setError("")}><X size={16} /></button></div>}
      <main className="content">
        {view === "home" && <>
          <section className="hero" style={{ backgroundImage: "linear-gradient(90deg, #101f28 1%, #101f28ee 34%, #101f2866 67%, #101f2808 100%), url('/reading-room.png')" }}>
            <div className="hero-copy"><span className="eyebrow light">HAFTANIN KİTABI</span><h1>Okuma Halkası</h1><p>Buluşma, katılım, puan, yorum ve fotoğraflar tek yerde.</p><button className="hero-link" onClick={() => featured && openMeeting(featured.id)}>Kitap sayfasına git <ArrowRight size={18} /></button></div>
            <div className="hero-counter"><span>{String(data.members.length).padStart(2, "0")}</span><small>aktif üye</small></div>
          </section>
          <div className="section-top"><div><span className="eyebrow">ŞİMDİ OKUYORUZ</span><h2>Bu haftanın kitabı</h2></div><button className="text-link" onClick={() => featured && openMeeting(featured.id)}>Kitap sayfasını aç <ArrowRight size={17} /></button></div>
          {featured && featuredBook ? <div className="featured-grid"><div className="featured-book-card" onClick={() => openMeeting(featured.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openMeeting(featured.id)}><div className="cover-stage"><BookCover book={featuredBook} /></div><div className="featured-details"><div className="edition-marker">HAFTANIN SEÇİMİ <span>№ {String(featured.id).padStart(2, "0")}</span></div><h3>{featuredBook.title}</h3><p className="author">{featuredBook.author}</p><div className="book-meta"><span><CalendarDays size={16} /> {readableDate(featured.date)}</span><span><MapPin size={16} /> {featured.location}</span></div><span className="feature-action">Kitap defterini aç <ArrowRight size={17} /></span></div></div>
            <div className="week-side"><div className="members-card"><div className="card-heading"><Users size={19} /><span>BU HAFTA MASADA</span></div><div className="large-avatars">{data.attendance.filter((item) => item.meetingId === featured.id).map((item) => data.members.find((person) => person.id === item.memberId)).filter((person): person is Member => !!person).map((person) => <Avatar member={person} key={person.id} />)}</div><strong>{data.attendance.filter((item) => item.meetingId === featured.id).length} kişi katılıyor</strong><p>Sen de buluşmaya geleceksen kitap sayfasında kendini ekleyebilirsin.</p><button onClick={() => openMeeting(featured.id)}>Katılımını belirt <ArrowRight size={15} /></button></div><div className="next-card"><div className="card-heading"><Compass size={19} /><span>SONRAKİ DURAK</span></div><strong>{findBook(data.roadmap[0]?.bookId)?.title ?? "Henüz planlanmadı"}</strong><p>{data.roadmap[0]?.plannedDate ? readableDate(data.roadmap[0].plannedDate) : "Yeni bir kitap seçilmeyi bekliyor"}</p><button onClick={() => navigate("roadmap")}>Yol haritasını gör <ArrowRight size={15} /></button></div></div></div>
          : <div className="empty-panel"><BookOpen /><h3>Henüz bir buluşma yok</h3><p>İlk kitabınızı ve buluşma yerini ekleyerek başlayın.</p><Button onClick={() => setCreateMode("meeting")}>İlk buluşmayı oluştur</Button></div>}
          <div className="lower-grid"><section className="mini-archive"><div className="mini-archive-title"><span className="eyebrow">ARŞİV</span><h3>Geçmiş buluşmalar</h3></div>{sortedMeetings.slice(1, 3).map((meeting) => <button key={meeting.id} onClick={() => openMeeting(meeting.id)}>{findBook(meeting.bookId)?.title}<span>{readableDate(meeting.date)} <ArrowRight size={15} /></span></button>)}{sortedMeetings.length <= 1 && <p>Geçmiş buluşma kaydı yok.</p>}<button className="text-link" onClick={() => navigate("archive")}>Tüm arşiv <ArrowRight size={16} /></button></section></div>
        </>}
        {view === "archive" && <><PageIntro eyebrow="ARŞİV" title="Buluşma arşivi" description="Önceki buluşmaların kitap, tarih, konum ve katılımcı kayıtları." /><div className="page-actions"><span>{sortedMeetings.length} buluşma kaydı</span><Button onClick={() => setCreateMode("meeting")}><Plus size={17} /> Yeni buluşma</Button></div><div className="archive-list">{sortedMeetings.map((meeting) => { const book = findBook(meeting.bookId); const count = data.attendance.filter((item) => item.meetingId === meeting.id).length; return book ? <button className="archive-item" key={meeting.id} onClick={() => openMeeting(meeting.id)}><BookCover book={book} small /><div><span className="eyebrow">{readableDate(meeting.date)}</span><h3>{book.title}</h3><p>{book.author}</p><div className="archive-meta"><span><MapPin size={14} /> {meeting.location}</span><span><Users size={14} /> {count} katılımcı</span></div></div><ArrowRight className="archive-arrow" size={22} /></button> : null; })}{!sortedMeetings.length && <div className="empty-panel">İlk buluşmanızı ekleyin.</div>}</div></>}
        {view === "roadmap" && <><PageIntro eyebrow="PLAN" title="Gelecek kitaplar" description="Planlanan kitaplar ve varsa tarihleri." /><div className="page-actions"><span>{data.roadmap.length} kitap sırada</span>{member.role === "admin" && <Button onClick={() => setCreateMode("plan")}><Plus size={17} /> Kitap planla</Button>}</div><div className="roadmap-list">{data.roadmap.map((item, index) => { const book = findBook(item.bookId); return book ? <div className="roadmap-item" key={item.id}><div className="plan-number">{String(index + 1).padStart(2, "0")}</div><BookCover book={book} small /><div className="plan-details"><span className="eyebrow">{item.plannedDate ? readableDate(item.plannedDate) : "TARİH BELİRLENMEDİ"}</span><h3>{book.title}</h3><p>{book.author}</p>{item.note && <small>{item.note}</small>}</div>{member.role === "admin" && <div className="plan-actions"><button className="plan-schedule" onClick={() => { setScheduledPlanId(item.id); setCreateMode("meeting"); }}>Buluşmaya taşı <ArrowRight size={15} /></button><button className="icon-action" aria-label={`${book.title} planını kaldır`} title="Plandan kaldır" disabled={busy} onClick={() => void perform("deletePlan", { planId: item.id })}><X size={17} /></button></div>}</div> : null; })}{!data.roadmap.length && <div className="empty-panel">Henüz gelecek kitap planlanmadı.</div>}</div></>}
        {view === "meeting" && selectedMeeting && activeBook && <><button className="back-link" onClick={() => navigate("archive")}>← Buluşma arşivine dön</button><div className="meeting-head"><div><span className="eyebrow">{readableDate(selectedMeeting.date)} · {dayFormat.format(new Date(selectedMeeting.date))}</span><h1>{activeBook.title}</h1><p>{activeBook.author}{activeBook.publisher ? ` · ${activeBook.publisher}` : ""}{activeBook.pages ? ` · ${activeBook.pages} sayfa` : ""}</p></div><div className="meeting-score"><Star size={23} fill="currentColor" /><strong>{avgRating}</strong><small>{reviews.length} puan</small></div></div><div className="meeting-layout"><div className="meeting-main"><section className="meeting-info paper-card"><div className="meeting-cover"><BookCover book={activeBook} /></div><div><span className="eyebrow">BULUŞMA</span><h2>Buluşma bilgileri</h2><p>{selectedMeeting.note || "Bu buluşma için not eklenmedi."}</p><div className="info-lines"><span><CalendarDays size={17} /> {readableDate(selectedMeeting.date)} · {new Date(selectedMeeting.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span><span><MapPin size={17} /> {selectedMeeting.location} {validMap(selectedMeeting.mapUrl) && <a href={selectedMeeting.mapUrl!} target="_blank" rel="noreferrer">Haritada aç <ExternalLink size={13} /></a>}</span>{activeBook.sourceUrl && <span><BookOpen size={17} /><a href={activeBook.sourceUrl} target="_blank" rel="noreferrer">Kitap künyesi <ExternalLink size={13} /></a></span>}</div>{member.role === "admin" && <button className="small-link" onClick={() => setEditMeetingOpen(true)}>Yer ve buluşma notunu düzenle <ArrowRight size={15} /></button>}</div></section><section className="paper-card gallery-card"><div className="section-row"><div><span className="eyebrow">FOTOĞRAFLAR</span><h2>Buluşma fotoğrafları</h2></div><label className={`upload-button ${busy ? "disabled" : ""}`}><ImagePlus size={17} /> Fotoğraf ekle<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "photo", selectedMeeting.id); event.target.value = ""; }} /></label></div>{pictures.length ? <div className="photo-grid">{pictures.map((picture) => <img key={picture.id} src={`/api/media/${picture.mediaKey}`} alt={`${activeBook.title} buluşmasından fotoğraf`} />)}</div> : <div className="gallery-empty"><Camera size={27} /><span>Fotoğraf eklenmedi.</span></div>}</section><section className="paper-card reviews-card"><div className="section-row"><div><span className="eyebrow">DEĞERLENDİRMELER</span><h2>Puanlar ve yorumlar</h2></div><span className="review-count">{reviews.length} değerlendirme</span></div>{reviews.length ? <div className="review-list">{reviews.map((review) => { const person = data.members.find((entry) => entry.id === review.memberId); return person && <div className="review-item" key={review.memberId}><Avatar member={person} /><div><strong>{person.name}</strong><span className="reading-chip">{readingLabels[data.attendance.find((a) => a.meetingId === selectedMeeting.id && a.memberId === review.memberId)?.readingStatus ?? "unselected"]}</span>{review.comment && <p>{review.comment}</p>}</div><span className="score-chip"><Star size={15} fill="currentColor" /> {review.rating}/10</span></div>; })}</div> : <p className="muted">Henüz puan veya yorum eklenmedi.</p>}</section></div><aside className="meeting-side"><section className="paper-card participation-card"><span className="eyebrow">KATILIM</span><h2>{myAttendance ? "Katılımın kayıtlı" : "Katıl"}</h2><p>Okuma durumunu seç ve kitaba 1–10 arasında puan ver. Yorum isteğe bağlı.</p><form onSubmit={async (event) => { event.preventDefault(); if (!rating) { setError("Katılımını kaydetmek için kitaba puan vermelisin."); return; } await perform("review", { meetingId: selectedMeeting.id, readingStatus: status, rating, comment }); }}><label className="field-label">Okuma durumum</label><RadioGroup className="read-options" value={status} onValueChange={(value) => setStatus(value as Attendance["readingStatus"])}>{(["read", "partial", "unread"] as const).map((option) => <label key={option}><RadioGroupItem value={option} /> {readingLabels[option]}</label>)}</RadioGroup><label className="field-label">Benim puanım <span>Zorunlu</span></label><div className="rating-grid" role="group" aria-label="Kitaba vereceğin puan">{Array.from({ length: 10 }, (_, i) => i + 1).map((value) => <button key={value} type="button" aria-pressed={rating === value} className={rating === value ? "selected" : ""} onClick={() => setRating(value)}>{value}</button>)}</div><label className="field-label" htmlFor="comment">Yorumum <span>İsteğe bağlı</span></label><Textarea id="comment" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Yorum yaz" rows={4} /><Button disabled={busy || !rating} type="submit" className="full-button">{myReview ? "Değerlendirmemi güncelle" : "Katılımımı ve puanımı kaydet"} <ArrowRight size={17} /></Button></form></section><section className="paper-card participants-card"><div className="section-row"><div><span className="eyebrow">KATILIMCILAR</span><h2>Katılımcılar <small>{attendees.length}</small></h2></div></div><div className="participant-list">{attendees.map((entry) => { const person = data.members.find((item) => item.id === entry.memberId); return person && <div key={entry.memberId}><Avatar member={person} size="small" /><span>{person.name}</span><small>{readingLabels[entry.readingStatus]}</small></div>; })}{!attendees.length && <p>Katılımcı eklenmedi.</p>}</div>{!myAttendance && <button className="small-link" onClick={() => document.querySelector(".participation-card")?.scrollIntoView({ behavior: "smooth" })}>Katılmak için puanını ver <ArrowRight size={15} /></button>}{member.role === "admin" && <div className="admin-add"><label htmlFor="add-person">Birini masaya ekle</label><div><select id="add-person" value={assignMember} onChange={(event) => setAssignMember(event.target.value)}><option value="">Kişi seç</option>{data.members.filter((entry) => !attendees.some((a) => a.memberId === entry.id)).map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select><button disabled={!assignMember || busy} onClick={async () => { await perform("addAttendance", { meetingId: selectedMeeting.id, targetId: Number(assignMember) }); setAssignMember(""); }} aria-label="Seçilen kişiyi ekle"><Plus size={18} /></button></div><small>Eklenen kişi kendi okuma durumunu ve zorunlu puanını daha sonra girer.</small></div>}</section></aside></div></>}
      </main>
      <footer className="footer"><span>okuma<span>halkası</span> · Kitap kulübü kayıtları</span><span>Bu ekran örnek üyelerle hazırlanmış önizlemedir.</span></footer>
    </div>
    <BookDialog mode={createMode} member={member} initialBook={scheduledPlanId ? findBook(data.roadmap.find((plan) => plan.id === scheduledPlanId)?.bookId ?? -1) : undefined} initialDate={scheduledPlanId ? data.roadmap.find((plan) => plan.id === scheduledPlanId)?.plannedDate ?? null : null} planId={scheduledPlanId} onClose={() => { setCreateMode(null); setScheduledPlanId(null); }} onUpload={(file) => upload(file, "cover")} onSubmit={async (payload) => { const result = await perform(createMode === "plan" ? "createPlan" : "createMeeting", payload); if (result) { setCreateMode(null); setScheduledPlanId(null); if (createMode === "meeting" && result.meetingId) { setMeetingId(result.meetingId); setView("meeting"); } } }} busy={busy} />
    <EditMeetingDialog meeting={selectedMeeting} open={editMeetingOpen} busy={busy} onClose={() => setEditMeetingOpen(false)} onSubmit={async (payload) => { const result = await perform("editMeeting", { meetingId: selectedMeeting?.id, ...payload }); if (result) setEditMeetingOpen(false); }} />
  </div>;
}

function EditMeetingDialog({ meeting, open, busy, onClose, onSubmit }: { meeting?: Meeting; open: boolean; busy: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [location, setLocation] = useState(""); const [mapUrl, setMapUrl] = useState(""); const [note, setNote] = useState("");
  useEffect(() => { if (open && meeting) { setLocation(meeting.location); setMapUrl(meeting.mapUrl ?? ""); setNote(meeting.note ?? ""); } }, [open, meeting?.id]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Buluşma bilgileri</DialogTitle><DialogDescription>Yer, harita bağlantısı ve konuşma notunu güncelle.</DialogDescription></DialogHeader><form className="create-form" onSubmit={(event) => { event.preventDefault(); void onSubmit({ location, mapUrl, note }); }}><label>Buluşma yeri *<Input required maxLength={180} value={location} onChange={(event) => setLocation(event.target.value)} /></label><label>Harita bağlantısı<Input type="url" value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} placeholder="https://maps.google.com/..." /></label><label>Konuşma notu<Textarea maxLength={1000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label><Button type="submit" disabled={busy} className="full-button">Kaydet</Button></form></DialogContent></Dialog>;
}

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>; }

function BookDialog({ mode, member, initialBook, initialDate, planId, onClose, onSubmit, onUpload, busy }: { mode: "meeting" | "plan" | null; member: Member; initialBook?: Book; initialDate: string | null; planId: number | null; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void>; onUpload: (file: File) => Promise<string | null>; busy: boolean }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Lookup[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [book, setBook] = useState<Lookup>({ title: "", author: "", publisher: null, pages: null, isbn: null, coverUrl: null, sourceUrl: null });
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [note, setNote] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  useEffect(() => { if (!mode) return; setSearchError(""); setMatches([]); setQuery(""); setBook(initialBook ?? { title: "", author: "", publisher: null, pages: null, isbn: null, coverUrl: null, sourceUrl: null }); setDate(initialDate ? mode === "meeting" ? `${initialDate}T15:00` : initialDate : ""); setLocation(""); setMapUrl(""); setNote(""); }, [mode, initialBook?.id, initialDate]);
  async function search() { if (query.trim().length < 3) return; setSearching(true); setSearchError(""); try { const response = await fetch(`/api/books/search?q=${encodeURIComponent(query.trim())}`); const result = await response.json() as { error?: string; books?: Lookup[] }; if (!response.ok) throw new Error(result.error); setMatches(result.books ?? []); if (!(result.books ?? []).length) setSearchError("Eşleşme bulunamadı; künyeyi elle girebilirsin."); } catch { setSearchError("Katalog şu an yanıt vermiyor; bilgileri elle girebilirsin."); } finally { setSearching(false); } }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!book.title.trim() || !book.author.trim()) return; const form = new FormData(event.currentTarget); void onSubmit({ book, planId, date: String(form.get("date") || date) || null, location: String(form.get("location") || location), mapUrl: String(form.get("mapUrl") || mapUrl), note: String(form.get("note") || note) }); }
  return <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>{mode === "plan" ? "Yol haritasına kitap ekle" : planId ? "Kitabı buluşmaya taşı" : "Yeni bir buluşma oluştur"}</DialogTitle><DialogDescription>{planId ? "Kitap seçildi; buluşmanın tarihini ve yerini tamamla." : "Kitabı katalogdan bulabilir veya künyeyi kendin yazabilirsin."}</DialogDescription></DialogHeader><div className="dialog-scroll">{!planId && <div className="lookup-row"><Input placeholder="Kitap adı veya ISBN ile ara" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} /><Button variant="outline" type="button" disabled={searching} onClick={() => void search()}><Search size={16} /> {searching ? "Aranıyor" : "Ara"}</Button></div>}{searchError && <p className="lookup-error">{searchError}</p>}{matches.length > 0 && <div className="lookup-results">{matches.map((match, i) => <button type="button" key={`${match.title}-${i}`} onClick={() => { setBook(match); setMatches([]); }}><span>{match.title}<small>{match.author}{match.publisher ? ` · ${match.publisher}` : ""}</small></span><Check size={17} /></button>)}</div>}<form onSubmit={submit} className="create-form"><div className="form-two"><label>Kitap adı *<Input required disabled={!!planId} value={book.title} maxLength={180} onChange={(e) => setBook({ ...book, title: e.target.value })} /></label><label>Yazar *<Input required disabled={!!planId} value={book.author} maxLength={140} onChange={(e) => setBook({ ...book, author: e.target.value })} /></label></div><div className="form-three"><label>Yayınevi<Input disabled={!!planId} value={book.publisher ?? ""} maxLength={140} onChange={(e) => setBook({ ...book, publisher: e.target.value })} /></label><label>Sayfa sayısı<Input disabled={!!planId} type="number" min="1" max="10000" value={book.pages ?? ""} onChange={(e) => setBook({ ...book, pages: e.target.value ? Number(e.target.value) : null })} /></label><label>ISBN<Input disabled={!!planId} value={book.isbn ?? ""} maxLength={20} onChange={(e) => setBook({ ...book, isbn: e.target.value })} /></label></div>{!planId && <label className="cover-field">Kapak görseli<input type="file" accept="image/jpeg,image/png,image/webp" disabled={coverBusy || busy} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setCoverBusy(true); const url = await onUpload(file); if (url) setBook((current) => ({ ...current, coverUrl: url })); setCoverBusy(false); }} />{book.coverUrl && <span>Kapak hazır ✓</span>}</label>}<div className="form-two"><label>{mode === "meeting" ? "Buluşma tarihi ve saati *" : "Planlanan tarih"}<Input name="date" type={mode === "meeting" ? "datetime-local" : "date"} required={mode === "meeting"} value={date} onChange={(e) => setDate(e.target.value)} /></label>{mode === "meeting" && <label>Buluşma yeri *<Input name="location" required value={location} maxLength={180} placeholder="Örn. Kadıköy · kitap kafe" onChange={(e) => setLocation(e.target.value)} /></label>}</div>{mode === "meeting" && <label>Harita bağlantısı<Input name="mapUrl" type="url" value={mapUrl} placeholder="https://maps.google.com/..." onChange={(e) => setMapUrl(e.target.value)} /></label>}<label>{mode === "plan" ? "Plan notu" : "Konuşulacaklar / not"}<Textarea name="note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="İsteğe bağlı" /></label><Button className="full-button" disabled={busy || coverBusy || (mode === "plan" && member.role !== "admin")} type="submit">{busy ? "Kaydediliyor…" : mode === "plan" ? "Planı ekle" : "Buluşmayı oluştur"} <ArrowRight size={17} /></Button></form></div></DialogContent></Dialog>;
}
