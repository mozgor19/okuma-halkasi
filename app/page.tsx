"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowRight, BookOpen, CalendarDays, Camera, Check, ChevronDown, ChevronRight, Compass, ExternalLink, ImagePlus, LogOut, MapPin, Pencil, Plus, Search, Star, UserRound, Users, X } from "lucide-react";
import { BookEditDialog } from "@/components/book-edit-dialog";
import { ContinuationDialog } from "@/components/continuation-dialog";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { ProfileView } from "@/components/profile-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { chooseFeatured, meetingTimingLabel } from "@/lib/meeting-time";
import { type AppData, type Book, type Meeting, type Member, type Attendance, readingLabels } from "@/lib/types";

type View = "home" | "archive" | "roadmap" | "meeting" | "profile";
type Lookup = { title: string; author: string; publisher: string | null; pages: number | null; isbn: string | null; coverUrl: string | null; sourceUrl: string | null };
const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("tr-TR", { weekday: "long" });
const readableDate = (value: string) => dateFormat.format(new Date(value));
const emptyData: AppData = { members: [], books: [], meetings: [], attendance: [], reviews: [], photos: [], roadmap: [], favorites: [] };
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
  return <span className={`avatar ${size === "small" ? "avatar-small" : ""}`} style={{ backgroundColor: member.color }} title={member.name} aria-label={member.name}>{member.avatarMediaKey ? <img src={`/api/media/${member.avatarMediaKey}`} alt="" /> : initials(member.name)}</span>;
}
function BookCover({ book, small = false }: { book: Book; small?: boolean }) {
  return <div className={`book-cover ${small ? "cover-small" : ""}`}>
    {book.coverUrl ? <img src={book.coverUrl} alt={`${book.title} kapağı`} /> : <div className="cover-placeholder"><span className="cover-ornament">✦</span><span className="cover-title">{book.title}</span><span className="cover-author">{book.author}</span></div>}
  </div>;
}

export default function Home() {
  const [data, setData] = useState<AppData>(emptyData);
  const [view, setView] = useState<View>("home");
  const [meetingId, setMeetingId] = useState<number | null>(null);
  const [createMode, setCreateMode] = useState<"meeting" | "plan" | null>(null);
  const [scheduledPlanId, setScheduledPlanId] = useState<number | null>(null);
  const [editMeetingOpen, setEditMeetingOpen] = useState(false);
  const [editBookOpen, setEditBookOpen] = useState(false);
  const [editBookId, setEditBookId] = useState<number | null>(null);
  const [continuationOpen, setContinuationOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Attendance["readingStatus"]>("read");
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [assignMember, setAssignMember] = useState("");

  async function reload() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (response.status === 401) {
      window.location.replace("/login");
      throw new Error("Oturum sona erdi.");
    }
    const updated = await response.json() as AppData & { error?: string };
    if (!response.ok) throw new Error(updated.error || "Buluşma kayıtları yüklenemedi.");
    const complete = { ...updated, favorites: updated.favorites ?? [] };
    setData(complete);
    return complete;
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload().catch((cause) => setError(cause instanceof Error ? cause.message : "Kayıtlar yüklenemedi."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const memberId = data.currentMemberId ?? 0;
  const member = data.members.find((person) => person.id === memberId)
    ?? { id: 0, name: "Üye", role: "member" as const, color: "#5e8b88", avatarMediaKey: null };
  const now = new Date();
  const sortedMeetings = useMemo(() => [...data.meetings].sort((a, b) => b.date.localeCompare(a.date)), [data.meetings]);
  const featuredChoice = chooseFeatured(data.meetings, now);
  const featured = featuredChoice.meeting;
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
  const featuredPast = featured ? new Date(featured.date) < now : false;
  const selectedPast = selectedMeeting ? new Date(selectedMeeting.date) < now : false;
  const pastMeetings = sortedMeetings.filter((meeting) => new Date(meeting.date) < now);
  const favoriteBookIds = new Set(data.favorites.filter((favorite) => favorite.memberId === memberId).map((favorite) => favorite.bookId));
  const selectedBookSessions = selectedMeeting ? [...data.meetings].filter((meeting) => meeting.bookId === selectedMeeting.bookId).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const sessionNumber = selectedMeeting ? selectedBookSessions.findIndex((meeting) => meeting.id === selectedMeeting.id) + 1 : 0;
  const featuredHeading = featuredChoice.kind === "week" ? "Bu haftanın kitabı" : featuredChoice.kind === "upcoming" ? "Sıradaki buluşma" : "Son buluşma";
  const featuredEyebrow = featuredChoice.kind === "week" ? "BU HAFTA" : featuredChoice.kind === "upcoming" ? "YAKLAŞAN BULUŞMA" : "ARŞİVDEN";

  async function perform(action: string, payload: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const result = await response.json() as { error?: string; meetingId?: number; ok?: boolean };
      if (!response.ok) throw new Error(result.error || "İşlem kaydedilemedi.");
      await reload();
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "İşlem kaydedilemedi.");
      return null;
    } finally { setBusy(false); }
  }
  function openMeeting(id: number) { const attendance = data.attendance.find((entry) => entry.meetingId === id && entry.memberId === memberId); const review = data.reviews.find((entry) => entry.meetingId === id && entry.memberId === memberId); setStatus(attendance?.readingStatus === "unselected" ? "read" : attendance?.readingStatus ?? "read"); setRating(review?.rating ?? null); setComment(review?.comment ?? ""); setMeetingId(id); setView("meeting"); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function navigate(next: View) { setView(next); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  async function upload(file: File, purpose: "photo" | "cover" | "avatar", currentMeeting?: number) {
    if (file.size > 8 * 1024 * 1024) { setError("Fotoğraf en fazla 8 MB olabilir."); return null; }
    setBusy(true); setError("");
    try {
      const prepared = await readyImage(file);
      const body = new FormData(); body.set("file", prepared); body.set("purpose", purpose);
      if (currentMeeting) body.set("meetingId", String(currentMeeting));
      const response = await fetch("/api/upload", { method: "POST", body });
      const result = await response.json().catch(() => ({ error: "Görsel gönderilemedi; daha küçük bir fotoğraf dene." })) as { error?: string; url?: string };
      if (!response.ok) throw new Error(result.error || "Görsel yüklenemedi.");
      if (purpose !== "cover") await reload();
      return result.url ?? null;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Görsel yüklenemedi."); return null; }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => navigate("home")}><span className="brand-emblem"><BookOpen size={25} strokeWidth={1.65} /></span><span>okuma<span className="brand-accent">halkası</span><small>kitap kulübü</small></span></button>
      <p className="nav-label">KEŞFET</p>
      <nav className="side-nav" aria-label="Ana menü">
        <button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}><BookOpen size={19} /> Ana sayfa</button>
        <button className={view === "archive" || view === "meeting" ? "active" : ""} onClick={() => navigate("archive")}><Archive size={19} /> Buluşmalar</button>
        <button className={view === "roadmap" ? "active" : ""} onClick={() => navigate("roadmap")}><Compass size={19} /> Gelecek kitaplar</button>
        <button className={view === "profile" ? "active" : ""} onClick={() => navigate("profile")}><UserRound size={19} /> Profilim</button>
      </nav>
      <div className="sidebar-bottom"><div className="tiny-rule" /><p>ÜYELER</p><div className="avatar-stack">{data.members.map((person) => <Avatar member={person} size="small" key={person.id} />)}</div><span className="sidebar-caption">{data.members.length} kayıtlı üye</span></div>
    </aside>

    <div className="main-area">
      <header className="topbar"><div className="mobile-brand"><BookOpen size={21} /> okuma<span>halkası</span></div><div className="breadcrumb">OKUMA HALKASI <ChevronRight size={14} /> <strong>{view === "home" ? "Ana sayfa" : view === "roadmap" ? "Gelecek kitaplar" : view === "archive" ? "Buluşmalar" : view === "profile" ? "Profilim" : "Kitap defteri"}</strong></div><div className="topbar-actions"><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="person-picker" aria-label="Hesap menüsü"><Avatar member={member} size="small" /><strong>{member.name}{member.role === "admin" ? " · yönetici" : ""}</strong><ChevronDown size={15} /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="account-menu"><DropdownMenuItem onSelect={() => navigate("profile")}><UserRound /> Profilim</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void signOut()}><LogOut /> Çıkış yap</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
      <div className="mobile-nav" aria-label="Mobil menü"><button onClick={() => navigate("home")} className={view === "home" ? "active" : ""}><BookOpen size={18} /> Ana sayfa</button><button onClick={() => navigate("archive")} className={view === "archive" || view === "meeting" ? "active" : ""}><Archive size={18} /> Buluşmalar</button><button onClick={() => navigate("roadmap")} className={view === "roadmap" ? "active" : ""}><Compass size={18} /> Plan</button><button onClick={() => navigate("profile")} className={view === "profile" ? "active" : ""}><UserRound size={18} /> Profil</button></div>
      {notice && <div className="success-banner" role="status">{notice}<button aria-label="Bildirimi kapat" onClick={() => setNotice("")}><X size={16} /></button></div>}
      {error && <div className="error-banner" role="alert">{error}<button aria-label="Uyarıyı kapat" onClick={() => setError("")}><X size={16} /></button></div>}
      <main className="content">
        {view === "home" && <>
          <section className="hero" style={{ backgroundImage: "linear-gradient(90deg, #101f28 1%, #101f28ee 34%, #101f2866 67%, #101f2808 100%), url('/reading-room.png')" }}>
            <div className="hero-copy"><span className="eyebrow light">{featuredEyebrow}</span><h1>Okuma Halkası</h1><p>Buluşma, katılım, puan, yorum ve fotoğraflar tek yerde.</p>{featured && <button className="hero-link" onClick={() => openMeeting(featured.id)}>Buluşma kaydını aç <ArrowRight size={18} /></button>}</div>
            <div className="hero-counter"><span>{String(data.members.length).padStart(2, "0")}</span><small>aktif üye</small></div>
          </section>
          <div className="section-top"><div><span className="eyebrow">{featuredEyebrow}</span><h2>{featuredHeading}</h2></div>{featured && <button className="text-link" onClick={() => openMeeting(featured.id)}>Buluşmayı aç <ArrowRight size={17} /></button>}</div>
          {featured && featuredBook ? <div className="featured-grid"><div className="featured-book-card" onClick={() => openMeeting(featured.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openMeeting(featured.id)}><div className="cover-stage"><BookCover book={featuredBook} /></div><div className="featured-details"><div className="edition-marker">{featured.bookStatus === "continuing" ? "OKUMA DEVAM EDECEK" : featuredEyebrow} <span>№ {String(featured.id).padStart(2, "0")}</span></div><h3>{featuredBook.title}</h3><p className="author">{featuredBook.author}</p>{featured.readingScope && <span className="reading-scope">{featured.readingScope}</span>}<div className="book-meta"><span><CalendarDays size={16} /> {readableDate(featured.date)}</span><span><MapPin size={16} /> {featured.location}</span></div><span className="feature-action">Kitap defterini aç <ArrowRight size={17} /></span></div></div>
            <div className="week-side"><div className="members-card"><div className="card-heading"><Users size={19} /><span>{featuredPast ? "MASADAYDI" : "MASADA"}</span></div><div className="large-avatars">{data.attendance.filter((item) => item.meetingId === featured.id).map((item) => data.members.find((person) => person.id === item.memberId)).filter((person): person is Member => !!person).map((person) => <Avatar member={person} key={person.id} />)}</div><strong>{data.attendance.filter((item) => item.meetingId === featured.id).length}{featuredPast ? " kişi katıldı" : " kişi katılıyor"}</strong><p>{featuredPast ? "Katılım, puan ve buluşma fotoğraflarını inceleyebilirsin." : "Katılacaksan kitap sayfasından durumunu belirtebilirsin."}</p><button onClick={() => openMeeting(featured.id)}>{featuredPast ? "Buluşma kaydını incele" : "Katılımını belirt"} <ArrowRight size={15} /></button></div><div className="next-card"><div className="card-heading"><Compass size={19} /><span>SONRAKİ DURAK</span></div><strong>{findBook(data.roadmap[0]?.bookId)?.title ?? "Henüz planlanmadı"}</strong><p>{data.roadmap[0]?.plannedDate ? readableDate(data.roadmap[0].plannedDate) : "Yeni bir kitap seçilmeyi bekliyor"}</p><button onClick={() => navigate("roadmap")}>Yol haritasını gör <ArrowRight size={15} /></button></div></div></div>
          : <div className="empty-panel"><BookOpen /><h3>Henüz bir buluşma yok</h3><p>İlk kitabınızı ve buluşma yerini ekleyerek başlayın.</p><Button onClick={() => setCreateMode("meeting")}>İlk buluşmayı oluştur</Button></div>}
          <div className="lower-grid"><section className="mini-archive"><div className="mini-archive-title"><span className="eyebrow">ARŞİV</span><h3>Geçmiş buluşmalar</h3></div>{pastMeetings.filter((meeting) => meeting.id !== featured?.id).slice(0, 2).map((meeting) => <button key={meeting.id} onClick={() => openMeeting(meeting.id)}>{findBook(meeting.bookId)?.title}<span>{readableDate(meeting.date)} <ArrowRight size={15} /></span></button>)}{!pastMeetings.filter((meeting) => meeting.id !== featured?.id).length && <p>Geçmiş buluşma kaydı yok.</p>}<button className="text-link" onClick={() => navigate("archive")}>Tüm arşiv <ArrowRight size={16} /></button></section></div>
        </>}
        {view === "archive" && <><PageIntro eyebrow="BULUŞMALAR" title="Buluşma kayıtları" description="Geçmiş ve yaklaşan buluşmaların kitap, tarih, konum ve katılımcı kayıtları." /><div className="page-actions"><span>{sortedMeetings.length} buluşma kaydı</span><Button onClick={() => setCreateMode("meeting")}><Plus size={17} /> Yeni buluşma</Button></div><div className="archive-list">{sortedMeetings.map((meeting) => { const book = findBook(meeting.bookId); const count = data.attendance.filter((item) => item.meetingId === meeting.id).length; return book ? <button className="archive-item" key={meeting.id} onClick={() => openMeeting(meeting.id)}><BookCover book={book} small /><div><span className="eyebrow">{meetingTimingLabel(meeting, now)} · {readableDate(meeting.date)}</span><h3>{book.title}</h3><p>{book.author}</p><div className="archive-meta">{meeting.readingScope && <span><BookOpen size={14} /> {meeting.readingScope}</span>}<span><MapPin size={14} /> {meeting.location}</span><span><Users size={14} /> {count} katılımcı</span></div></div>{meeting.bookStatus === "continuing" && <span className="continuing-badge">Devam edecek</span>}<ArrowRight className="archive-arrow" size={22} /></button> : null; })}{!sortedMeetings.length && <div className="empty-panel">İlk buluşmanızı ekleyin.</div>}</div></>}
        {view === "roadmap" && <><PageIntro eyebrow="PLAN" title="Gelecek kitaplar" description="Planlanan kitaplar ve varsa tarihleri." /><div className="page-actions"><span>{data.roadmap.length} kitap sırada</span>{member.role === "admin" && <Button onClick={() => setCreateMode("plan")}><Plus size={17} /> Kitap planla</Button>}</div><div className="roadmap-list">{data.roadmap.map((item, index) => { const book = findBook(item.bookId); return book ? <div className="roadmap-item" key={item.id}><div className="plan-number">{String(index + 1).padStart(2, "0")}</div><BookCover book={book} small /><div className="plan-details"><span className="eyebrow">{item.plannedDate ? readableDate(item.plannedDate) : "TARİH BELİRLENMEDİ"}</span><h3>{book.title}</h3><p>{book.author}</p>{item.note && <small>{item.note}</small>}</div>{member.role === "admin" && <div className="plan-actions"><button className="icon-action" aria-label={`${book.title} künyesini düzenle`} title="Kitap künyesini düzenle" onClick={() => { setEditBookId(book.id); setEditBookOpen(true); }}><Pencil size={17} /></button><button className="plan-schedule" onClick={() => { setScheduledPlanId(item.id); setCreateMode("meeting"); }}>Buluşmaya taşı <ArrowRight size={15} /></button><button className="icon-action" aria-label={`${book.title} planını kaldır`} title="Plandan kaldır" disabled={busy} onClick={() => void perform("deletePlan", { planId: item.id })}><X size={17} /></button></div>}</div> : null; })}{!data.roadmap.length && <div className="empty-panel">Henüz gelecek kitap planlanmadı.</div>}</div></>}
        {view === "profile" && <ProfileView data={data} member={member} busy={busy} onOpenMeeting={openMeeting} onUploadAvatar={(file) => upload(file, "avatar")} onToggleFavorite={async (bookId, active) => { await perform("toggleFavorite", { bookId, active }); }} onNotice={setNotice} />}
        {view === "meeting" && selectedMeeting && activeBook && <><button className="back-link" onClick={() => navigate("archive")}>← Buluşma arşivine dön</button><div className="meeting-head"><div><span className="eyebrow">{meetingTimingLabel(selectedMeeting, now)} · {readableDate(selectedMeeting.date)} · {dayFormat.format(new Date(selectedMeeting.date))}{selectedBookSessions.length > 1 ? ` · ${sessionNumber}. OTURUM` : ""}</span><h1>{activeBook.title}</h1><p>{activeBook.author}{activeBook.publisher ? ` · ${activeBook.publisher}` : ""}{activeBook.pages ? ` · ${activeBook.pages} sayfa` : ""}</p><div className="meeting-title-actions"><button type="button" className={favoriteBookIds.has(activeBook.id) ? "favorite active" : "favorite"} onClick={() => void perform("toggleFavorite", { bookId: activeBook.id, active: !favoriteBookIds.has(activeBook.id) })}><Star size={16} fill={favoriteBookIds.has(activeBook.id) ? "currentColor" : "none"} /> {favoriteBookIds.has(activeBook.id) ? "Favorilerimde" : "Favoriye ekle"}</button><span className={`book-progress ${selectedMeeting.bookStatus}`}>{selectedMeeting.bookStatus === "continuing" ? "Okuma devam edecek" : "Kitap tamamlandı"}</span></div></div><div className="meeting-score"><Star size={23} fill="currentColor" /><strong>{avgRating}</strong><small>{reviews.length} puan</small></div></div>{selectedMeeting.bookStatus === "continuing" && <section className="continuation-band"><div><span className="eyebrow">DEVAM EDEN OKUMA</span><strong>{selectedMeeting.readingScope ? `${selectedMeeting.readingScope} bu buluşmada ele alınıyor.` : "Kitabın kalan kısmı sonraki buluşmada devam edecek."}</strong></div>{member.role === "admin" && <Button onClick={() => setContinuationOpen(true)}><Plus size={17} /> Devam buluşması oluştur</Button>}</section>}<div className="meeting-layout"><div className="meeting-main"><section className="meeting-info paper-card"><div className="meeting-cover"><BookCover book={activeBook} /></div><div><span className="eyebrow">BULUŞMA</span><h2>Buluşma bilgileri</h2><p>{selectedMeeting.note || "Bu buluşma için not eklenmedi."}</p><div className="info-lines">{selectedMeeting.readingScope && <span><BookOpen size={17} /> Okunan bölüm: {selectedMeeting.readingScope}</span>}<span><CalendarDays size={17} /> {readableDate(selectedMeeting.date)} · {new Date(selectedMeeting.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span><span><MapPin size={17} /> {selectedMeeting.location} {validMap(selectedMeeting.mapUrl) && <a href={selectedMeeting.mapUrl!} target="_blank" rel="noreferrer">Haritada aç <ExternalLink size={13} /></a>}</span>{activeBook.sourceUrl && <span><BookOpen size={17} /><a href={activeBook.sourceUrl} target="_blank" rel="noreferrer">Kitap künyesi <ExternalLink size={13} /></a></span>}</div>{member.role === "admin" && <div className="record-actions"><button className="small-link" onClick={() => setEditMeetingOpen(true)}><Pencil size={15} /> Buluşmayı düzenle</button><button className="small-link" onClick={() => { setEditBookId(activeBook.id); setEditBookOpen(true); }}><Pencil size={15} /> Kitap künyesini düzenle</button></div>}</div></section><section className="paper-card gallery-card"><div className="section-row"><div><span className="eyebrow">FOTOĞRAFLAR</span><h2>Buluşma fotoğrafları</h2></div><label className={`upload-button ${busy ? "disabled" : ""}`}><ImagePlus size={17} /> Fotoğraf ekle<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "photo", selectedMeeting.id); event.target.value = ""; }} /></label></div>{pictures.length ? <div className="photo-grid">{pictures.map((picture) => <PhotoLightbox key={picture.id} src={`/api/media/${picture.mediaKey}`} alt={`${activeBook.title} buluşmasından fotoğraf`} caption={activeBook.title} detail={readableDate(selectedMeeting.date)} />)}</div> : <div className="gallery-empty"><Camera size={27} /><span>Fotoğraf eklenmedi.</span></div>}</section><section className="paper-card reviews-card"><div className="section-row"><div><span className="eyebrow">DEĞERLENDİRMELER</span><h2>Puanlar ve yorumlar</h2></div><span className="review-count">{reviews.length} değerlendirme</span></div>{reviews.length ? <div className="review-list">{reviews.map((review) => { const person = data.members.find((entry) => entry.id === review.memberId); return person && <div className="review-item" key={review.memberId}><Avatar member={person} /><div><strong>{person.name}</strong><span className="reading-chip">{readingLabels[data.attendance.find((a) => a.meetingId === selectedMeeting.id && a.memberId === review.memberId)?.readingStatus ?? "unselected"]}</span>{review.comment && <p>{review.comment}</p>}</div><span className="score-chip"><Star size={15} fill="currentColor" /> {review.rating}/10</span></div>; })}</div> : <p className="muted">Henüz puan veya yorum eklenmedi.</p>}</section></div><aside className="meeting-side"><section className="paper-card participation-card"><span className="eyebrow">KATILIM</span><h2>{myAttendance ? "Katılımın kayıtlı" : selectedPast ? "Katılımını kaydet" : "Katıl"}</h2><p>{selectedPast ? "Bu buluşmaya katıldıysan okuma durumunu, puanını ve yorumunu kaydedebilirsin." : "Okuma durumunu seç ve kitaba 1-10 arasında puan ver. Yorum isteğe bağlı."}</p><form onSubmit={async (event) => { event.preventDefault(); if (!rating) { setError("Katılımını kaydetmek için kitaba puan vermelisin."); return; } await perform("review", { meetingId: selectedMeeting.id, readingStatus: status, rating, comment }); }}><label className="field-label">Okuma durumum</label><RadioGroup className="read-options" value={status} onValueChange={(value) => setStatus(value as Attendance["readingStatus"])}>{(["read", "partial", "unread"] as const).map((option) => <label key={option}><RadioGroupItem value={option} /> {readingLabels[option]}</label>)}</RadioGroup><label className="field-label">Benim puanım <span>Zorunlu</span></label><div className="rating-grid" role="group" aria-label="Kitaba vereceğin puan">{Array.from({ length: 10 }, (_, i) => i + 1).map((value) => <button key={value} type="button" aria-pressed={rating === value} className={rating === value ? "selected" : ""} onClick={() => setRating(value)}>{value}</button>)}</div><label className="field-label" htmlFor="comment">Yorumum <span>İsteğe bağlı</span></label><Textarea id="comment" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Yorum yaz" rows={4} /><Button disabled={busy || !rating} type="submit" className="full-button">{myReview ? "Değerlendirmemi güncelle" : "Katılımımı ve puanımı kaydet"} <ArrowRight size={17} /></Button></form></section><section className="paper-card participants-card"><div className="section-row"><div><span className="eyebrow">KATILIMCILAR</span><h2>Katılımcılar <small>{attendees.length}</small></h2></div></div><div className="participant-list">{attendees.map((entry) => { const person = data.members.find((item) => item.id === entry.memberId); return person && <div key={entry.memberId}><Avatar member={person} size="small" /><span>{person.name}</span><small>{readingLabels[entry.readingStatus]}</small></div>; })}{!attendees.length && <p>Katılımcı eklenmedi.</p>}</div>{!myAttendance && <button className="small-link" onClick={() => document.querySelector(".participation-card")?.scrollIntoView({ behavior: "smooth" })}>{selectedPast ? "Katılımını kaydet" : "Katılmak için puanını ver"} <ArrowRight size={15} /></button>}{member.role === "admin" && <div className="admin-add"><label htmlFor="add-person">Birini masaya ekle</label><div><select id="add-person" value={assignMember} onChange={(event) => setAssignMember(event.target.value)}><option value="">Kişi seç</option>{data.members.filter((entry) => !attendees.some((a) => a.memberId === entry.id)).map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select><button disabled={!assignMember || busy} onClick={async () => { await perform("addAttendance", { meetingId: selectedMeeting.id, targetId: Number(assignMember) }); setAssignMember(""); }} aria-label="Seçilen kişiyi ekle"><Plus size={18} /></button></div><small>Eklenen kişi kendi okuma durumunu ve zorunlu puanını daha sonra girer.</small></div>}</section></aside></div></>}
      </main>
      <footer className="footer"><span>okuma<span>halkası</span> · Kitap kulübü kayıtları</span></footer>
    </div>
    {createMode && <BookDialog mode={createMode} member={member} initialBook={scheduledPlanId ? findBook(data.roadmap.find((plan) => plan.id === scheduledPlanId)?.bookId ?? -1) : undefined} initialDate={scheduledPlanId ? data.roadmap.find((plan) => plan.id === scheduledPlanId)?.plannedDate ?? null : null} planId={scheduledPlanId} onClose={() => { setCreateMode(null); setScheduledPlanId(null); }} onUpload={(file) => upload(file, "cover")} onSubmit={async (payload) => { const result = await perform(createMode === "plan" ? "createPlan" : "createMeeting", payload); if (result) { setCreateMode(null); setScheduledPlanId(null); if (createMode === "meeting" && result.meetingId) { setMeetingId(result.meetingId); setView("meeting"); } } }} busy={busy} />}
    {editMeetingOpen && <EditMeetingDialog meeting={selectedMeeting} open={editMeetingOpen} busy={busy} onClose={() => setEditMeetingOpen(false)} onSubmit={async (payload) => { const result = await perform("editMeeting", { meetingId: selectedMeeting?.id, ...payload }); if (result) setEditMeetingOpen(false); }} />}
    {editBookOpen && <BookEditDialog book={editBookId ? findBook(editBookId) : activeBook} open={editBookOpen} busy={busy} onClose={() => { setEditBookOpen(false); setEditBookId(null); }} onUpload={(file) => upload(file, "cover")} onSubmit={async (bookId, book) => { const result = await perform("editBook", { bookId, book }); if (result) { setEditBookOpen(false); setEditBookId(null); setNotice("Kitap künyesi güncellendi."); } }} />}
    {continuationOpen && <ContinuationDialog book={activeBook} previousMeeting={selectedMeeting} open={continuationOpen} busy={busy} onClose={() => setContinuationOpen(false)} onSubmit={async (payload) => { const result = await perform("createMeeting", payload); if (result?.meetingId) { setContinuationOpen(false); openMeeting(result.meetingId); } }} />}
  </div>;
}

function EditMeetingDialog({ meeting, open, busy, onClose, onSubmit }: { meeting?: Meeting; open: boolean; busy: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [date, setDate] = useState(meeting?.date ?? "");
  const [location, setLocation] = useState(meeting?.location ?? "");
  const [mapUrl, setMapUrl] = useState(meeting?.mapUrl ?? "");
  const [note, setNote] = useState(meeting?.note ?? "");
  const [readingScope, setReadingScope] = useState(meeting?.readingScope ?? "");
  const [bookStatus, setBookStatus] = useState<"continuing" | "completed">(meeting?.bookStatus ?? "completed");

  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Buluşma bilgileri</DialogTitle><DialogDescription>Tarihi, yeri, okunan bölümü ve kitabın devam durumunu güncelle.</DialogDescription></DialogHeader><form className="create-form" onSubmit={(event) => { event.preventDefault(); void onSubmit({ date, location, mapUrl, note, readingScope, bookStatus }); }}><div className="form-two"><label>Tarih ve saat *<Input type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Buluşma yeri *<Input required maxLength={180} value={location} onChange={(event) => setLocation(event.target.value)} /></label></div><label>Okunan bölüm<Input maxLength={180} value={readingScope} onChange={(event) => setReadingScope(event.target.value)} placeholder="Örn. İlk yarı · 1-160. sayfalar" /></label><label>Bu buluşmadan sonra<select value={bookStatus} onChange={(event) => setBookStatus(event.target.value as "continuing" | "completed")}><option value="completed">Kitap tamamlandı</option><option value="continuing">Okuma devam edecek</option></select></label><label>Harita bağlantısı<Input type="url" value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} placeholder="https://maps.google.com/..." /></label><label>Konuşma notu<Textarea maxLength={1000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label><Button type="submit" disabled={busy} className="full-button">Kaydet</Button></form></DialogContent></Dialog>;
}

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>; }

function BookDialog({ mode, member, initialBook, initialDate, planId, onClose, onSubmit, onUpload, busy }: { mode: "meeting" | "plan" | null; member: Member; initialBook?: Book; initialDate: string | null; planId: number | null; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void>; onUpload: (file: File) => Promise<string | null>; busy: boolean }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Lookup[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [book, setBook] = useState<Lookup>(initialBook ?? { title: "", author: "", publisher: null, pages: null, isbn: null, coverUrl: null, sourceUrl: null });
  const [date, setDate] = useState(initialDate ? mode === "meeting" ? `${initialDate}T15:00` : initialDate : "");
  const [location, setLocation] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [note, setNote] = useState("");
  const [readingScope, setReadingScope] = useState("");
  const [bookStatus, setBookStatus] = useState<"continuing" | "completed">("completed");
  const [coverBusy, setCoverBusy] = useState(false);
  async function search() { if (query.trim().length < 3) return; setSearching(true); setSearchError(""); try { const response = await fetch(`/api/books/search?q=${encodeURIComponent(query.trim())}`); const result = await response.json() as { error?: string; books?: Lookup[] }; if (!response.ok) throw new Error(result.error); setMatches(result.books ?? []); if (!(result.books ?? []).length) setSearchError("Eşleşme bulunamadı; künyeyi elle girebilirsin."); } catch { setSearchError("Katalog şu an yanıt vermiyor; bilgileri elle girebilirsin."); } finally { setSearching(false); } }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!book.title.trim() || !book.author.trim()) return; const form = new FormData(event.currentTarget); void onSubmit({ book, planId, date: String(form.get("date") || date) || null, location: String(form.get("location") || location), mapUrl: String(form.get("mapUrl") || mapUrl), note: String(form.get("note") || note), readingScope: String(form.get("readingScope") || readingScope), bookStatus }); }
  return <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>{mode === "plan" ? "Yol haritasına kitap ekle" : planId ? "Kitabı buluşmaya taşı" : "Yeni bir buluşma oluştur"}</DialogTitle><DialogDescription>{planId ? "Kitap seçildi; buluşmanın tarihini ve yerini tamamla." : "Kitabı katalogdan bulabilir veya künyeyi kendin yazabilirsin."}</DialogDescription></DialogHeader><div className="dialog-scroll">{!planId && <div className="lookup-row"><Input placeholder="Kitap adı veya ISBN ile ara" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} /><Button variant="outline" type="button" disabled={searching} onClick={() => void search()}><Search size={16} /> {searching ? "Aranıyor" : "Ara"}</Button></div>}{searchError && <p className="lookup-error">{searchError}</p>}{matches.length > 0 && <div className="lookup-results">{matches.map((match, i) => <button type="button" key={`${match.title}-${i}`} onClick={() => { setBook(match); setMatches([]); }}><span>{match.title}<small>{match.author}{match.publisher ? ` · ${match.publisher}` : ""}</small></span><Check size={17} /></button>)}</div>}<form onSubmit={submit} className="create-form"><div className="form-two"><label>Kitap adı *<Input required disabled={!!planId} value={book.title} maxLength={180} onChange={(e) => setBook({ ...book, title: e.target.value })} /></label><label>Yazar *<Input required disabled={!!planId} value={book.author} maxLength={140} onChange={(e) => setBook({ ...book, author: e.target.value })} /></label></div><div className="form-three"><label>Yayınevi<Input disabled={!!planId} value={book.publisher ?? ""} maxLength={140} onChange={(e) => setBook({ ...book, publisher: e.target.value })} /></label><label>Sayfa sayısı<Input disabled={!!planId} type="number" min="1" max="10000" value={book.pages ?? ""} onChange={(e) => setBook({ ...book, pages: e.target.value ? Number(e.target.value) : null })} /></label><label>ISBN<Input disabled={!!planId} value={book.isbn ?? ""} maxLength={20} onChange={(e) => setBook({ ...book, isbn: e.target.value })} /></label></div>{!planId && <label className="cover-field">Kapak görseli<input type="file" accept="image/jpeg,image/png,image/webp" disabled={coverBusy || busy} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setCoverBusy(true); const url = await onUpload(file); if (url) setBook((current) => ({ ...current, coverUrl: url })); setCoverBusy(false); }} />{book.coverUrl && <span>Kapak hazır ✓</span>}</label>}<div className="form-two"><label>{mode === "meeting" ? "Buluşma tarihi ve saati *" : "Planlanan tarih"}<Input name="date" type={mode === "meeting" ? "datetime-local" : "date"} required={mode === "meeting"} value={date} onChange={(e) => setDate(e.target.value)} /></label>{mode === "meeting" && <label>Buluşma yeri *<Input name="location" required value={location} maxLength={180} placeholder="Örn. Kadıköy · kitap kafe" onChange={(e) => setLocation(e.target.value)} /></label>}</div>{mode === "meeting" && <><label>Bu buluşmada okunacak bölüm<Input name="readingScope" value={readingScope} maxLength={180} placeholder="Örn. İlk yarı · 1-160. sayfalar" onChange={(e) => setReadingScope(e.target.value)} /></label><label>Bu buluşmadan sonra<select value={bookStatus} onChange={(event) => setBookStatus(event.target.value as "continuing" | "completed")}><option value="completed">Kitap tamamlandı</option><option value="continuing">Okuma devam edecek</option></select></label><label>Harita bağlantısı<Input name="mapUrl" type="url" value={mapUrl} placeholder="https://maps.google.com/..." onChange={(e) => setMapUrl(e.target.value)} /></label></>}<label>{mode === "plan" ? "Plan notu" : "Konuşulacaklar / not"}<Textarea name="note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="İsteğe bağlı" /></label><Button className="full-button" disabled={busy || coverBusy || (mode === "plan" && member.role !== "admin")} type="submit">{busy ? "Kaydediliyor…" : mode === "plan" ? "Planı ekle" : "Buluşmayı oluştur"} <ArrowRight size={17} /></Button></form></div></DialogContent></Dialog>;
}
