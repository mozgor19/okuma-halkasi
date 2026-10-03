"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowRight, BookOpen, CalendarDays, CalendarPlus, Camera, Check, ChevronDown, ChevronRight, Compass, Download, ExternalLink, ImagePlus, LogOut, MapPin, Pencil, Plus, Search, Star, Trash2, UserPlus, UserRound, UserSwitch, Users, X } from "@/components/icons";
import { AttendanceSuggestionDialog } from "@/components/attendance-suggestion-dialog";
import { AppearanceModeMenu } from "@/components/appearance-mode-menu";
import { BookEditDialog } from "@/components/book-edit-dialog";
import { GlobalSearchDialog } from "@/components/global-search-dialog";
import { NotificationCenter } from "@/components/notification-center";
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
import type { FaceMatchCandidate } from "@/lib/face-recognition";
import { isAdminRole, type AppData, type Book, type Meeting, type Member, type Attendance, readingLabels } from "@/lib/types";

type View = "home" | "archive" | "roadmap" | "meeting" | "profile";
type AppNavigationState = { view: View; meetingId: number | null; guard?: boolean };
type Lookup = { title: string; author: string; publisher: string | null; pages: number | null; isbn: string | null; coverUrl: string | null; sourceUrl: string | null };
type FaceSuggestion = { meetingId: number; candidates: FaceMatchCandidate[]; faceCount: number };
const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("tr-TR", { weekday: "long" });
const navigationKey = "kitapTahlilNavigation";
const viewModeKey = "kitapTahlilViewMode";
const views: View[] = ["home", "archive", "roadmap", "meeting", "profile"];
const readableDate = (value: string) => dateFormat.format(new Date(value));
const emptyData: AppData = { members: [], books: [], meetings: [], attendance: [], reviews: [], photos: [], roadmap: [], favorites: [], bookVotes: [], voteVisibility: "open", trash: [], clubFeaturesReady: false };
const initials = (name: string) => name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
const validMap = (url: string | null) => url && /^https:\/\//i.test(url) ? url : null;

function readNavigationState(state: unknown): AppNavigationState | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[navigationKey];
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AppNavigationState>;
  if (!candidate.view || !views.includes(candidate.view)) return null;
  return {
    view: candidate.view,
    meetingId: typeof candidate.meetingId === "number" ? candidate.meetingId : null,
    guard: candidate.guard === true,
  };
}

function historyState(navigation: AppNavigationState) {
  const current = window.history.state;
  const base = current && typeof current === "object" ? current : {};
  return { ...base, [navigationKey]: navigation };
}

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
  const [currentPage, setCurrentPage] = useState("");
  const [assignMember, setAssignMember] = useState("");
  const [guestName, setGuestName] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [albumBusy, setAlbumBusy] = useState(false);
  const [recognitionBusy, setRecognitionBusy] = useState(false);
  const [faceSuggestion, setFaceSuggestion] = useState<FaceSuggestion | null>(null);
  const [viewMode, setViewMode] = useState<"admin" | "member">(() => {
    if (typeof window === "undefined") return "admin";
    return window.localStorage.getItem(viewModeKey) === "member" ? "member" : "admin";
  });

  async function reload() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (response.status === 401) {
      window.location.replace("/login");
      throw new Error("Oturum sona erdi.");
    }
    const updated = await response.json() as AppData & { error?: string };
    if (!response.ok) throw new Error(updated.error || "Buluşma kayıtları yüklenemedi.");
    const complete = { ...updated, favorites: updated.favorites ?? [], bookVotes: updated.bookVotes ?? [], voteVisibility: updated.voteVisibility ?? "open", trash: updated.trash ?? [], clubFeaturesReady: updated.clubFeaturesReady ?? false };
    setData(complete);
    return complete;
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload().catch((cause) => setError(cause instanceof Error ? cause.message : "Kayıtlar yüklenemedi."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const current = readNavigationState(window.history.state);
    if (!current) {
      window.history.replaceState(historyState({ view: "home", meetingId: null, guard: true }), "", window.location.href);
      window.history.pushState(historyState({ view: "home", meetingId: null }), "", window.location.href);
    } else if (current.guard) {
      window.history.pushState(historyState({ view: "home", meetingId: null }), "", window.location.href);
    } else {
      window.history.replaceState(historyState({ view: "home", meetingId: null }), "", window.location.href);
    }
  }, []);

  const memberId = data.currentMemberId ?? 0;
  const accountMember = data.members.find((person) => person.id === memberId)
    ?? { id: 0, name: "Üye", role: "member" as const, color: "#5e8b88", avatarMediaKey: null, faceReferenceMediaKey: null, faceRecognitionConsent: false, isGuest: false, guestMeetingId: null };
  const isAdminAccount = isAdminRole(accountMember.role);
  const participantView = isAdminAccount && viewMode === "member";
  const member: Member = participantView ? { ...accountMember, role: "member" } : accountMember;
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

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const destination = readNavigationState(event.state);
      if (!destination) return;
      const atGuard = destination.guard === true;
      const nextView = atGuard ? "home" : destination.view;
      const nextMeetingId = atGuard ? null : destination.meetingId;
      if (atGuard) {
        window.history.pushState(historyState({ view: "home", meetingId: null }), "", window.location.href);
      }
      if (nextView === "meeting" && nextMeetingId !== null) {
        const attendance = data.attendance.find((entry) => entry.meetingId === nextMeetingId && entry.memberId === memberId);
        const review = data.reviews.find((entry) => entry.meetingId === nextMeetingId && entry.memberId === memberId);
        setStatus(attendance?.readingStatus === "unselected" ? "read" : attendance?.readingStatus ?? "read");
        setRating(review?.rating ?? null);
        setComment(review?.comment ?? "");
        setCurrentPage(attendance?.currentPage === null || attendance?.currentPage === undefined ? "" : String(attendance.currentPage));
      }
      setMeetingId(nextMeetingId);
      setView(nextView);
      setError("");
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [data.attendance, data.reviews, memberId]);

  async function perform(action: string, payload: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const result = await response.json() as { error?: string; meetingId?: number; ok?: boolean; added?: number };
      if (!response.ok) throw new Error(result.error || "İşlem kaydedilemedi.");
      await reload();
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "İşlem kaydedilemedi.");
      return null;
    } finally { setBusy(false); }
  }
  function openMeeting(id: number) { const attendance = data.attendance.find((entry) => entry.meetingId === id && entry.memberId === memberId); const review = data.reviews.find((entry) => entry.meetingId === id && entry.memberId === memberId); setStatus(attendance?.readingStatus === "unselected" ? "read" : attendance?.readingStatus ?? "read"); setRating(review?.rating ?? null); setComment(review?.comment ?? ""); setCurrentPage(attendance?.currentPage === null || attendance?.currentPage === undefined ? "" : String(attendance.currentPage)); if (view !== "meeting" || meetingId !== id) window.history.pushState(historyState({ view: "meeting", meetingId: id }), "", window.location.href); setMeetingId(id); setView("meeting"); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function navigate(next: View) { if (next !== view) window.history.pushState(historyState({ view: next, meetingId: null }), "", window.location.href); setMeetingId(null); setView(next); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  function changeViewMode(nextMode: "admin" | "member") {
    setViewMode(nextMode);
    window.localStorage.setItem(viewModeKey, nextMode);
    setEditMeetingOpen(false);
    setEditBookOpen(false);
    setEditBookId(null);
    setContinuationOpen(false);
    setFaceSuggestion(null);
    setScheduledPlanId(null);
    setCreateMode(null);
    setNotice(nextMode === "member" ? "Katılımcı görünümüne geçtin." : "Yönetici görünümüne döndün.");
  }

  async function upload(
    file: File,
    purpose: "photo" | "cover" | "avatar" | "faceReference",
    currentMeeting?: number,
    targetMemberId?: number,
    alreadyPrepared = false,
  ) {
    if (file.size > 8 * 1024 * 1024) { setError("Fotoğraf en fazla 8 MB olabilir."); return null; }
    setBusy(true); setError("");
    try {
      const prepared = alreadyPrepared ? file : await readyImage(file);
      const body = new FormData(); body.set("file", prepared); body.set("purpose", purpose);
      if (currentMeeting) body.set("meetingId", String(currentMeeting));
      if (targetMemberId) body.set("targetMemberId", String(targetMemberId));
      const response = await fetch("/api/upload", { method: "POST", body });
      const result = await response.json().catch(() => ({ error: "Görsel gönderilemedi; daha küçük bir fotoğraf dene." })) as { error?: string; url?: string };
      if (!response.ok) throw new Error(result.error || "Görsel yüklenemedi.");
      if (purpose !== "cover") await reload();
      return result.url ?? null;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Görsel yüklenemedi."); return null; }
    finally { setBusy(false); }
  }

  async function uploadFaceReference(targetMemberId: number, file: File) {
    if (file.size > 8 * 1024 * 1024) {
      setError("Fotoğraf en fazla 8 MB olabilir.");
      return null;
    }
    setRecognitionBusy(true);
    setError("");
    setNotice("Referans fotoğrafı yalnızca bu cihazda kontrol ediliyor.");
    try {
      const prepared = await readyImage(file);
      const { validateFaceReference } = await import("@/lib/face-recognition");
      const faceCount = await validateFaceReference(prepared);
      if (faceCount !== 1) {
        throw new Error(
          faceCount
            ? "Referans fotoğrafında yalnızca bir kişi olmalı."
            : "Referans fotoğrafında seçilebilir bir yüz bulunamadı.",
        );
      }
      const uploaded = await upload(
        prepared,
        "faceReference",
        undefined,
        targetMemberId,
        true,
      );
      if (uploaded) setNotice("");
      return uploaded;
    } catch (cause) {
      setNotice("");
      setError(cause instanceof Error ? cause.message : "Referans fotoğrafı doğrulanamadı.");
      return null;
    } finally {
      setRecognitionBusy(false);
    }
  }

  async function uploadMeetingPhoto(file: File, currentMeeting: number) {
    if (file.size > 8 * 1024 * 1024) {
      setError("Fotoğraf en fazla 8 MB olabilir.");
      return;
    }
    let prepared: File;
    try {
      prepared = await readyImage(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Fotoğraf işlenemedi.");
      return;
    }

    const uploaded = await upload(prepared, "photo", currentMeeting, undefined, true);
    if (!uploaded) return;
    if (!isAdminRole(member.role)) {
      setNotice("Fotoğraf buluşmaya eklendi.");
      return;
    }

    setRecognitionBusy(true);
    setNotice("Fotoğraf eklendi. Yüzler yalnızca bu cihazda inceleniyor.");
    try {
      const { recognizeAttendees } = await import("@/lib/face-recognition");
      const result = await recognizeAttendees(prepared, data.members);
      if (!result.usableReferenceCount) {
        setNotice("Fotoğraf eklendi. Eşleştirme için kullanılabilir yüz referansı bulunamadı.");
      } else if (!result.faceCount) {
        setNotice("Fotoğraf eklendi; fotoğrafta seçilebilir bir yüz bulunamadı.");
      } else if (!result.candidates.length) {
        setNotice("Fotoğraf eklendi; güvenli eşik üzerinde bir eşleşme bulunamadı.");
      } else {
        setNotice("");
        setFaceSuggestion({
          meetingId: currentMeeting,
          candidates: result.candidates,
          faceCount: result.faceCount,
        });
      }
    } catch (cause) {
      console.error("Browser face recognition failed", cause);
      setError("Fotoğraf eklendi ancak yüz eşleştirme bu cihazda tamamlanamadı.");
    } finally {
      setRecognitionBusy(false);
    }
  }


  async function downloadAlbum(title: string, date: string) {
    if (!pictures.length || albumBusy) return;
    setAlbumBusy(true);
    setError("");
    try {
      const { zipSync } = await import("fflate");
      const files: Record<string, Uint8Array> = {};
      await Promise.all(pictures.map(async (picture, index) => {
        const response = await fetch(`/api/media/${picture.mediaKey}`);
        if (!response.ok) throw new Error("Albüm fotoğraflarından biri indirilemedi.");
        const type = response.headers.get("content-type") ?? "image/jpeg";
        const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
        files[`${String(index + 1).padStart(2, "0")}-fotoğraf.${extension}`] =
          new Uint8Array(await response.arrayBuffer());
      }));
      const archive = zipSync(files, { level: 6 });
      const blob = new Blob([archive.slice().buffer as ArrayBuffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeTitle = title.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gi, "-").replace(/^-|-$/g, "");
      link.href = url;
      link.download = `${date.slice(0, 10)}-${safeTitle || "bulusma"}-albumu.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Albüm indirilemedi.");
    } finally {
      setAlbumBusy(false);
    }
  }

  return <div className={`app-shell view-${view}`}>
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => navigate("home")}><span className="brand-emblem"><BookOpen size={25} strokeWidth={1.65} /></span><span>Kitap Tahlil<span className="brand-accent"> &amp; İstişare</span><small>kitap kulübü</small></span></button>
      <p className="nav-label">KEŞFET</p>
      <nav className="side-nav" aria-label="Ana menü">
        <button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}><BookOpen size={19} /> Ana sayfa</button>
        <button className={view === "archive" || view === "meeting" ? "active" : ""} onClick={() => navigate("archive")}><Archive size={19} /> Buluşmalar</button>
        <button className={view === "roadmap" ? "active" : ""} onClick={() => navigate("roadmap")}><Compass size={19} /><span className="roadmap-nav-full">Gelecek kitaplar</span><span className="roadmap-nav-short">Plan</span></button>
        <button className={view === "profile" ? "active" : ""} onClick={() => navigate("profile")}><UserRound size={19} /> Profilim</button>
      </nav>
      <div className="sidebar-bottom"><div className="tiny-rule" /><p>ÜYELER</p><div className="avatar-stack">{data.members.filter((person) => !person.isGuest).map((person) => <Avatar member={person} size="small" key={person.id} />)}</div><span className="sidebar-caption">{data.members.filter((person) => !person.isGuest).length} kayıtlı üye</span></div>
    </aside>

    <div className="main-area">
      <header className="topbar"><button className="mobile-brand" type="button" onClick={() => navigate("home")} aria-label="Ana sayfaya git"><BookOpen size={21} /><span>Kitap Tahlil <b>&amp; İstişare</b></span></button><div className="breadcrumb">KİTAP TAHLİL &amp; İSTİŞARE <ChevronRight size={14} /> <strong>{view === "home" ? "Ana sayfa" : view === "roadmap" ? "Gelecek kitaplar" : view === "archive" ? "Buluşmalar" : view === "profile" ? "Profilim" : "Kitap defteri"}</strong></div><div className="topbar-actions"><button type="button" className="topbar-tool" aria-label="Kayıtlarda ara" title="Ara" onClick={() => setSearchOpen(true)}><Search size={18} /></button><NotificationCenter data={data} memberId={memberId} now={now.getTime()} onOpenMeeting={openMeeting} /><AppearanceModeMenu /><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="person-picker" aria-label="Hesap menüsü"><Avatar member={member} size="small" /><strong>{member.name}{isAdminAccount ? participantView ? " · katılımcı görünümü" : accountMember.role === "super_admin" ? " · ana yönetici" : " · yönetici" : ""}</strong><ChevronDown size={15} /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="account-menu"><DropdownMenuItem onSelect={() => navigate("profile")}><UserRound /> Profilim</DropdownMenuItem>{isAdminAccount && <DropdownMenuItem onSelect={() => changeViewMode(participantView ? "admin" : "member")}><UserSwitch className="size-4" />{participantView ? "Yönetici görünümüne dön" : "Katılımcı görünümüne geç"}</DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void signOut()}><LogOut /> Çıkış yap</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
      <div className="mobile-nav" aria-label="Mobil menü"><button onClick={() => navigate("home")} className={view === "home" ? "active" : ""}><BookOpen size={18} /> Ana sayfa</button><button onClick={() => navigate("archive")} className={view === "archive" || view === "meeting" ? "active" : ""}><Archive size={18} /> Buluşmalar</button><button onClick={() => navigate("roadmap")} className={view === "roadmap" ? "active" : ""}><Compass size={18} /> Plan</button><button onClick={() => navigate("profile")} className={view === "profile" ? "active" : ""}><UserRound size={18} /> Profil</button></div>
      {notice && <div className="success-banner" role="status">{notice}<button aria-label="Bildirimi kapat" onClick={() => setNotice("")}><X size={16} /></button></div>}
      {error && <div className="error-banner" role="alert">{error}<button aria-label="Uyarıyı kapat" onClick={() => setError("")}><X size={16} /></button></div>}
      <main className="content">
        {view === "home" && <>
          <section className="hero" style={{ backgroundImage: "linear-gradient(90deg, #101f28 1%, #101f28ee 34%, #101f2866 67%, #101f2808 100%), url('/reading-room.png')" }}>
            <div className="hero-copy"><span className="eyebrow light">{featuredEyebrow}</span><h1><span className="theme-copy-default">Kitap Tahlil &amp; İstişare</span><span className="theme-copy-notebook">{featuredBook?.title ?? "Kitap Tahlil & İstişare"}</span></h1><p className="theme-copy-default">Buluşma, katılım, puan, yorum ve fotoğraflar tek yerde.</p><p className="theme-copy-notebook">{featured?.note || (featuredBook ? `${featuredBook.author} ile aynı masada buluşuyoruz.` : "Yeni okuma kaydını birlikte oluşturalım.")}</p>{featured && <button className="hero-link" onClick={() => openMeeting(featured.id)}>Buluşma kaydını aç <ArrowRight size={18} /></button>}</div>
            <figure className="notebook-hero-media"><img src="/reading-room.png" alt="Kitaplarla çevrili okuma odası" /><figcaption><span>{featured ? String(new Date(featured.date).getDate()).padStart(2, "0") : "--"}</span><strong>{featured ? dayFormat.format(new Date(featured.date)) : "Yeni buluşma"}</strong><small>{featured?.location ?? "Kitap kulübü"}</small></figcaption></figure>
            <div className="hero-counter"><span>{String(data.members.filter((person) => !person.isGuest).length).padStart(2, "0")}</span><small>aktif üye</small></div>
          </section>
          <div className="section-top"><div><span className="eyebrow">{featuredEyebrow}</span><h2>{featuredHeading}</h2></div>{featured && <button className="text-link" onClick={() => openMeeting(featured.id)}>Buluşmayı aç <ArrowRight size={17} /></button>}</div>
          {featured && featuredBook ? <div className="featured-grid"><div className="featured-book-card" onClick={() => openMeeting(featured.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openMeeting(featured.id)}><div className="cover-stage"><BookCover book={featuredBook} /></div><div className="featured-details"><div className="edition-marker">{featured.bookStatus === "continuing" ? "OKUMA DEVAM EDECEK" : featuredEyebrow} <span>№ {String(featured.id).padStart(2, "0")}</span></div><h3>{featuredBook.title}</h3><p className="author">{featuredBook.author}</p>{featured.readingScope && <span className="reading-scope">{featured.readingScope}</span>}<div className="book-meta"><span><CalendarDays size={16} /> {readableDate(featured.date)}</span><span><MapPin size={16} /> {featured.location}</span></div><span className="feature-action">Kitap defterini aç <ArrowRight size={17} /></span></div></div>
            <div className="week-side"><div className="members-card"><div className="card-heading"><Users size={19} /><span>{featuredPast ? "MASADAYDI" : "MASADA"}</span></div><div className="large-avatars">{data.attendance.filter((item) => item.meetingId === featured.id).map((item) => data.members.find((person) => person.id === item.memberId)).filter((person): person is Member => !!person).map((person) => <Avatar member={person} key={person.id} />)}</div><strong>{data.attendance.filter((item) => item.meetingId === featured.id).length}{featuredPast ? " kişi katıldı" : " kişi katılıyor"}</strong><p>{featuredPast ? "Katılım, puan ve buluşma fotoğraflarını inceleyebilirsin." : "Katılacaksan kitap sayfasından durumunu belirtebilirsin."}</p><button onClick={() => openMeeting(featured.id)}>{featuredPast ? "Buluşma kaydını incele" : "Katılımını belirt"} <ArrowRight size={15} /></button></div><div className="next-card"><div className="card-heading"><Compass size={19} /><span>SONRAKİ DURAK</span></div><strong>{findBook(data.roadmap[0]?.bookId)?.title ?? "Henüz planlanmadı"}</strong><p>{data.roadmap[0]?.plannedDate ? readableDate(data.roadmap[0].plannedDate) : "Yeni bir kitap seçilmeyi bekliyor"}</p><button onClick={() => navigate("roadmap")}>Yol haritasını gör <ArrowRight size={15} /></button></div></div></div>
          : <div className="empty-panel"><BookOpen /><h3>Henüz bir buluşma yok</h3><p>İlk kitabınızı ve buluşma yerini ekleyerek başlayın.</p>{isAdminRole(member.role) && <Button onClick={() => setCreateMode("meeting")}>İlk buluşmayı oluştur</Button>}</div>}
          <div className="lower-grid"><section className="mini-archive"><div className="mini-archive-title"><span className="eyebrow">ARŞİV</span><h3>Geçmiş buluşmalar</h3></div>{pastMeetings.filter((meeting) => meeting.id !== featured?.id).slice(0, 2).map((meeting) => <button key={meeting.id} onClick={() => openMeeting(meeting.id)}>{findBook(meeting.bookId)?.title}<span>{readableDate(meeting.date)} <ArrowRight size={15} /></span></button>)}{!pastMeetings.filter((meeting) => meeting.id !== featured?.id).length && <p>Geçmiş buluşma kaydı yok.</p>}<button className="text-link" onClick={() => navigate("archive")}>Tüm arşiv <ArrowRight size={16} /></button></section></div>
        </>}
        {view === "archive" && <><PageIntro eyebrow="BULUŞMALAR" title="Buluşma kayıtları" description="Geçmiş ve yaklaşan buluşmaların kitap, tarih, konum ve katılımcı kayıtları." /><div className="page-actions"><span>{sortedMeetings.length} buluşma kaydı</span>{isAdminRole(member.role) && <Button onClick={() => setCreateMode("meeting")}><Plus size={17} /> Yeni buluşma</Button>}</div><div className="archive-list">{sortedMeetings.map((meeting) => { const book = findBook(meeting.bookId); const count = data.attendance.filter((item) => item.meetingId === meeting.id).length; return book ? <button className="archive-item" key={meeting.id} onClick={() => openMeeting(meeting.id)}><BookCover book={book} small /><div><span className="eyebrow">{meetingTimingLabel(meeting, now)} · {readableDate(meeting.date)}</span><h3>{book.title}</h3><p>{book.author}</p><div className="archive-meta">{meeting.readingScope && <span><BookOpen size={14} /> {meeting.readingScope}</span>}<span><MapPin size={14} /> {meeting.location}</span><span><Users size={14} /> {count} katılımcı</span></div></div>{meeting.bookStatus === "continuing" && <span className="continuing-badge">Devam edecek</span>}<ArrowRight className="archive-arrow" size={22} /></button> : null; })}{!sortedMeetings.length && <div className="empty-panel">İlk buluşmanızı ekleyin.</div>}</div></>}
        {view === "roadmap" && <section className="roadmap-page">
          <div className="page-intro roadmap-intro">
            <span className="eyebrow"><span className="theme-copy-default">PLAN</span><span className="theme-copy-notebook">OKUMA PUSULASI</span></span>
            <h1><span className="theme-copy-default">Gelecek kitaplar</span><span className="theme-copy-notebook">Sıradaki kitap</span></h1>
            <p><span className="theme-copy-default">Önerilen kitaplar, topluluğun oyları ve planlanan tarihler.</span><span className="theme-copy-notebook">Öneriler masaya gelsin, herkes oyunu versin; seçilen kitap buluşma planına taşınsın.</span></p>
          </div>
          <div className="page-actions">
            <span>{data.roadmap.length} kitap adayı</span>
            <Button onClick={() => setCreateMode("plan")}><Plus size={17} /> Kitap öner</Button>
          </div>
          <section className="roadmap-question">
            <div className="roadmap-question-copy"><span className="eyebrow">OYLAMA / {data.voteVisibility === "open" ? "AÇIK" : "GİZLİ"}</span><h2>Hangi kitabı okuyalım?</h2></div>
            {isAdminRole(member.role) && (
              <div className="vote-admin-bar">
                <span>Oy verenler</span>
                <div className="vote-visibility" role="group" aria-label="Oy görünürlüğü">
                  <button className={data.voteVisibility === "open" ? "active" : ""} onClick={() => void perform("setVoteVisibility", { voteVisibility: "open" })}>Açık</button>
                  <button className={data.voteVisibility === "secret" ? "active" : ""} onClick={() => void perform("setVoteVisibility", { voteVisibility: "secret" })}>Gizli</button>
                </div>
                <button className="small-link" disabled={!data.bookVotes.length || busy} onClick={() => {
                  if (window.confirm("Tüm kitap oyları sıfırlansın mı?")) void perform("clearBookVotes", {});
                }}>Oyları sıfırla</button>
              </div>
            )}
          </section>
          <div className="roadmap-list">
            {data.roadmap.map((item, index) => {
              const book = findBook(item.bookId);
              if (!book) return null;
              const votes = data.bookVotes.filter((vote) => vote.roadmapId === item.id);
              const myVote = votes.some((vote) => vote.memberId === memberId);
              const voters = votes
                .map((vote) => data.members.find((person) => person.id === vote.memberId))
                .filter((person): person is Member => Boolean(person));
              return (
                <div className={`roadmap-item ${myVote ? "is-voted" : ""}`} key={item.id}>
                  <div className="plan-number">{String(index + 1).padStart(2, "0")}</div>
                  <BookCover book={book} small />
                  <div className="plan-details">
                    <span className="eyebrow">{item.plannedDate ? readableDate(item.plannedDate) : "TARİH BELİRLENMEDİ"}</span>
                    <h3>{book.title}</h3>
                    <p>{book.author}</p>
                    {item.note && <small>{item.note}</small>}
                    {voters.length > 0 && data.voteVisibility === "open" && (
                      <span className="vote-names">{voters.map((person) => person.name).join(", ")}</span>
                    )}
                  </div>
                  <div className="plan-voting">
                    <button type="button" className={myVote ? "vote-button active" : "vote-button"} disabled={busy} aria-pressed={myVote} onClick={() => void perform("voteBook", { roadmapId: item.id, active: !myVote })}>
                      {myVote ? <Check size={16} /> : <Star size={16} />}
                      {myVote ? "Oy verdin" : "Oy ver"}
                    </button>
                    <span>{votes.length} oy</span>
                  </div>
                  {isAdminRole(member.role) && (
                    <div className="plan-actions">
                      <button className="icon-action" aria-label={`${book.title} künyesini düzenle`} title="Kitap künyesini düzenle" onClick={() => { setEditBookId(book.id); setEditBookOpen(true); }}><Pencil size={17} /></button>
                      <button className="plan-schedule" onClick={() => { setScheduledPlanId(item.id); setCreateMode("meeting"); }}>Buluşmaya taşı <ArrowRight size={15} /></button>
                      <button className="icon-action" aria-label={`${book.title} planını çöpe taşı`} title="Çöpe taşı" disabled={busy} onClick={() => void perform("deletePlan", { planId: item.id })}><Trash2 size={17} /></button>
                    </div>
                  )}
                </div>
              );
            })}
            {!data.roadmap.length && <div className="empty-panel">Henüz gelecek kitap önerilmedi.</div>}
          </div>
        </section>}
        {view === "profile" && <ProfileView key={member.role} data={data} member={member} busy={busy} onOpenMeeting={openMeeting} onUploadAvatar={(file) => upload(file, "avatar")} onUploadFaceReference={uploadFaceReference} onClearFaceReference={async (targetId) => Boolean(await perform("clearFaceReference", { targetId }))} onToggleFavorite={async (bookId, active) => { await perform("toggleFavorite", { bookId, active }); }} onRestoreTrash={async (type, id) => { const result = await perform("restoreTrash", { trashType: type, targetId: id }); if (result) setNotice("Kayıt geri alındı."); }} onPurgeTrash={async (type, id) => { const result = await perform("purgeTrash", { trashType: type, targetId: id }); if (result) setNotice("Kayıt kalıcı olarak silindi."); }} onSetMemberRole={async (targetId, role) => { const result = await perform("setMemberRole", { targetId, role }); if (result) setNotice(role === "admin" ? "Üye yönetici olarak atandı." : "Yönetici katılımcı rolüne alındı."); return Boolean(result); }} onNotice={setNotice} />}
        {view === "meeting" && selectedMeeting && activeBook && <><button className="back-link" onClick={() => navigate("archive")}>← Buluşma arşivine dön</button><div className="meeting-head"><div><span className="eyebrow">{meetingTimingLabel(selectedMeeting, now)} · {readableDate(selectedMeeting.date)} · {dayFormat.format(new Date(selectedMeeting.date))}{selectedBookSessions.length > 1 ? ` · ${sessionNumber}. OTURUM` : ""}</span><h1>{activeBook.title}</h1><p>{activeBook.author}{activeBook.publisher ? ` · ${activeBook.publisher}` : ""}{activeBook.pages ? ` · ${activeBook.pages} sayfa` : ""}</p><div className="meeting-title-actions"><button type="button" className={favoriteBookIds.has(activeBook.id) ? "favorite active" : "favorite"} onClick={() => void perform("toggleFavorite", { bookId: activeBook.id, active: !favoriteBookIds.has(activeBook.id) })}><Star size={16} fill={favoriteBookIds.has(activeBook.id) ? "currentColor" : "none"} /> {favoriteBookIds.has(activeBook.id) ? "Favorilerimde" : "Favoriye ekle"}</button><span className={`book-progress ${selectedMeeting.bookStatus}`}>{selectedMeeting.bookStatus === "continuing" ? "Okuma devam edecek" : "Kitap tamamlandı"}</span></div></div><div className="meeting-score"><Star size={23} fill="currentColor" /><strong>{avgRating}</strong><small>{reviews.length} puan</small></div></div>{selectedMeeting.bookStatus === "continuing" && <section className="continuation-band"><div><span className="eyebrow">DEVAM EDEN OKUMA</span><strong>{selectedMeeting.readingScope ? `${selectedMeeting.readingScope} bu buluşmada ele alınıyor.` : "Kitabın kalan kısmı sonraki buluşmada devam edecek."}</strong></div>{isAdminRole(member.role) && <Button onClick={() => setContinuationOpen(true)}><Plus size={17} /> Devam buluşması oluştur</Button>}</section>}<div className="meeting-layout"><div className="meeting-main"><section className="meeting-info paper-card"><div className="meeting-cover"><BookCover book={activeBook} /></div><div><span className="eyebrow">BULUŞMA</span><h2>Buluşma bilgileri</h2><p>{selectedMeeting.note || "Bu buluşma için not eklenmedi."}</p><div className="info-lines">{selectedMeeting.readingScope && <span><BookOpen size={17} /> Okunan bölüm: {selectedMeeting.readingScope}</span>}<span><CalendarDays size={17} /> {readableDate(selectedMeeting.date)} · {new Date(selectedMeeting.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} <a className="calendar-link" href={`/api/calendar/${selectedMeeting.id}`} download><CalendarPlus size={13} /> Takvime ekle</a></span><span><MapPin size={17} /> {selectedMeeting.location} {validMap(selectedMeeting.mapUrl) && <a href={selectedMeeting.mapUrl!} target="_blank" rel="noreferrer">Haritada aç <ExternalLink size={13} /></a>}</span>{activeBook.sourceUrl && <span><BookOpen size={17} /><a href={activeBook.sourceUrl} target="_blank" rel="noreferrer">Kitap künyesi <ExternalLink size={13} /></a></span>}</div>{isAdminRole(member.role) && <div className="record-actions"><button className="small-link" onClick={() => setEditMeetingOpen(true)}><Pencil size={15} /> Buluşmayı düzenle</button><button className="small-link" onClick={() => { setEditBookId(activeBook.id); setEditBookOpen(true); }}><Pencil size={15} /> Kitap künyesini düzenle</button><button className="small-link destructive-link" onClick={async () => { if (!window.confirm("Bu buluşma çöp kutusuna taşınsın mı?")) return; const result = await perform("deleteMeeting", { meetingId: selectedMeeting.id }); if (result) { setNotice("Buluşma çöp kutusuna taşındı."); navigate("archive"); } }}><Trash2 size={15} /> Buluşmayı sil</button></div>}</div></section><section className="paper-card gallery-card"><div className="section-row"><div><span className="eyebrow">FOTOĞRAFLAR</span><h2>Buluşma fotoğrafları</h2></div><div className="gallery-actions">{pictures.length > 0 && <button type="button" className="upload-button" disabled={albumBusy} onClick={() => void downloadAlbum(activeBook.title, selectedMeeting.date)}><Download size={17} /> {albumBusy ? "Hazırlanıyor" : "Albümü indir"}</button>}<label className={`upload-button ${busy || recognitionBusy ? "disabled" : ""}`}><ImagePlus size={17} /> {recognitionBusy ? "Yüzler inceleniyor" : "Fotoğraf ekle"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || recognitionBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMeetingPhoto(file, selectedMeeting.id); event.target.value = ""; }} /></label></div></div>{pictures.length ? <div className="photo-grid">{pictures.map((picture) => <PhotoLightbox key={picture.id} src={`/api/media/${picture.mediaKey}`} alt={`${activeBook.title} buluşmasından fotoğraf`} caption={activeBook.title} detail={readableDate(selectedMeeting.date)} destructiveAction={isAdminRole(member.role) ? { label: "Fotoğrafı sil", disabled: busy, onSelect: async () => { if (!window.confirm("Bu fotoğraf kalıcı olarak silinsin mi?")) return false; const result = await perform("deletePhoto", { photoId: picture.id }); if (result) setNotice("Fotoğraf silindi."); return Boolean(result); } } : undefined} />)}</div> : <div className="gallery-empty"><Camera size={27} /><span>Fotoğraf eklenmedi.</span></div>}</section><section className="paper-card reviews-card"><div className="section-row"><div><span className="eyebrow">DEĞERLENDİRMELER</span><h2>Puanlar ve yorumlar</h2></div><span className="review-count">{reviews.length} değerlendirme</span></div>{reviews.length ? <div className="review-list">{reviews.map((review) => { const person = data.members.find((entry) => entry.id === review.memberId); return person && <div className="review-item" key={review.memberId}><Avatar member={person} /><div><strong>{person.name}</strong><span className="reading-chip">{readingLabels[data.attendance.find((a) => a.meetingId === selectedMeeting.id && a.memberId === review.memberId)?.readingStatus ?? "unselected"]}</span>{review.comment && <p>{review.comment}</p>}</div><span className="score-chip"><Star size={15} fill="currentColor" /> {review.rating}/10</span></div>; })}</div> : <p className="muted">Henüz puan veya yorum eklenmedi.</p>}</section></div><aside className="meeting-side"><section className="paper-card participation-card"><span className="eyebrow">KATILIM</span><h2>{myAttendance ? "Katılımın kayıtlı" : selectedPast ? "Katılımını kaydet" : "Katıl"}</h2><p>{selectedPast ? "Bu buluşmaya katıldıysan okuma durumunu kaydet; okuduysan puan ve yorum ekleyebilirsin." : "Okuma durumunu seç. Okumadıysan puan vermeden de katılımını kaydedebilirsin."}</p><form onSubmit={async (event) => { event.preventDefault(); if (!rating && status !== "unread") { setError("Okuduysan veya kısmen okuduysan kitaba puan vermelisin."); return; } await perform("review", { meetingId: selectedMeeting.id, readingStatus: status, rating, comment, currentPage: currentPage === "" ? null : Number(currentPage) }); }}><label className="field-label">Okuma durumum</label><RadioGroup className="read-options" value={status} onValueChange={(value) => { const nextStatus = value as Attendance["readingStatus"]; setStatus(nextStatus); if (nextStatus === "unread") { setRating(null); setComment(""); setCurrentPage(""); } }}>{(["read", "partial", "unread"] as const).map((option) => <label key={option}><RadioGroupItem value={option} /> {readingLabels[option]}</label>)}</RadioGroup>{activeBook.pages && <><label className="field-label" htmlFor="current-page">Kaldığım sayfa <span>{activeBook.pages} sayfa</span></label><Input id="current-page" className="progress-input" type="number" min="0" max={activeBook.pages} value={currentPage} onChange={(event) => setCurrentPage(event.target.value)} placeholder="Örn. 120" /></>}<label className="field-label">Benim puanım <span>{status === "unread" ? "İsteğe bağlı" : "Zorunlu"}</span></label><div className="rating-grid" role="group" aria-label="Kitaba vereceğin puan">{Array.from({ length: 10 }, (_, i) => i + 1).map((value) => <button key={value} type="button" aria-pressed={rating === value} className={rating === value ? "selected" : ""} onClick={() => setRating(value)}>{value}</button>)}</div><label className="field-label" htmlFor="comment">Yorumum <span>{rating ? "İsteğe bağlı" : "Puanla birlikte"}</span></label><Textarea id="comment" maxLength={1000} disabled={!rating} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={rating ? "Yorum yaz" : "Yorum eklemek için önce puan seç"} rows={4} /><Button disabled={busy || (!rating && status !== "unread")} type="submit" className="full-button">{rating ? myReview ? "Değerlendirmemi güncelle" : "Katılımımı ve puanımı kaydet" : myAttendance ? "Katılımımı güncelle" : "Katılımımı kaydet"} <ArrowRight size={17} /></Button></form></section><section className="paper-card participants-card"><div className="section-row"><div><span className="eyebrow">KATILIMCILAR</span><h2>Katılımcılar <small>{attendees.length}</small></h2></div></div><div className="participant-list">{attendees.map((entry) => { const person = data.members.find((item) => item.id === entry.memberId); return person && <div key={entry.memberId}><Avatar member={person} size="small" /><span>{person.name}{person.isGuest && <em className="guest-badge">Misafir</em>}</span><small>{entry.currentPage !== null && activeBook.pages ? `${entry.currentPage}/${activeBook.pages} · ` : ""}{readingLabels[entry.readingStatus]}</small></div>; })}{!attendees.length && <p>Katılımcı eklenmedi.</p>}</div>{!myAttendance && <button className="small-link" onClick={() => document.querySelector(".participation-card")?.scrollIntoView({ behavior: "smooth" })}>{selectedPast ? "Katılımını kaydet" : "Katılımını belirt"} <ArrowRight size={15} /></button>}{isAdminRole(member.role) && <div className="admin-add"><label htmlFor="add-person">Birini masaya ekle</label><div><select id="add-person" value={assignMember} onChange={(event) => setAssignMember(event.target.value)}><option value="">Kişi seç</option>{data.members.filter((entry) => !entry.isGuest && !attendees.some((a) => a.memberId === entry.id)).map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select><button disabled={!assignMember || busy} onClick={async () => { await perform("addAttendance", { meetingId: selectedMeeting.id, targetId: Number(assignMember) }); setAssignMember(""); }} aria-label="Seçilen kişiyi ekle"><Plus size={18} /></button></div><small>Eklenen kişi kendi okuma durumunu; okuduysa puanını daha sonra girer.</small><label htmlFor="guest-name" className="guest-label"><UserPlus size={14} /> Misafir ekle</label><div><Input id="guest-name" value={guestName} maxLength={80} placeholder="Adı soyadı" onChange={(event) => setGuestName(event.target.value)} /><button type="button" disabled={guestName.trim().length < 2 || busy} onClick={async () => { const result = await perform("addGuest", { meetingId: selectedMeeting.id, guestName }); if (result) { setGuestName(""); setNotice("Misafir katılımcı eklendi."); } }} aria-label="Misafiri ekle"><Plus size={18} /></button></div></div>}</section></aside></div></>}
      </main>
      <footer className="footer"><span>Kitap Tahlil <span>&amp; İstişare</span></span><span>Okuma grubu kayıtları</span></footer>
    </div>
    {faceSuggestion && <AttendanceSuggestionDialog
      open
      meetingId={faceSuggestion.meetingId}
      candidates={faceSuggestion.candidates}
      faceCount={faceSuggestion.faceCount}
      alreadyAttending={new Set(data.attendance.filter((entry) => entry.meetingId === faceSuggestion.meetingId).map((entry) => entry.memberId))}
      members={data.members}
      busy={busy}
      onOpenChange={(open) => { if (!open) setFaceSuggestion(null); }}
      onConfirm={async (targetIds) => {
        if (!faceSuggestion) return false;
        const result = await perform("confirmDetectedAttendance", { meetingId: faceSuggestion.meetingId, targetIds });
        if (!result) return false;
        setNotice(`${targetIds.length} katılımcı buluşmaya eklendi.`);
        return true;
      }}
    />}
    <GlobalSearchDialog data={data} open={searchOpen} onOpenChange={setSearchOpen} onOpenMeeting={openMeeting} onOpenRoadmap={() => navigate("roadmap")} />
    {createMode && <BookDialog mode={createMode} member={member} initialBook={scheduledPlanId ? findBook(data.roadmap.find((plan) => plan.id === scheduledPlanId)?.bookId ?? -1) : undefined} initialDate={scheduledPlanId ? data.roadmap.find((plan) => plan.id === scheduledPlanId)?.plannedDate ?? null : null} planId={scheduledPlanId} onClose={() => { setCreateMode(null); setScheduledPlanId(null); }} onUpload={(file) => upload(file, "cover")} onSubmit={async (payload) => { const result = await perform(createMode === "plan" ? "createPlan" : "createMeeting", payload); if (result) { setCreateMode(null); setScheduledPlanId(null); if (createMode === "meeting" && result.meetingId) openMeeting(result.meetingId); } }} busy={busy} />}
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
  return <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>{mode === "plan" ? "Yol haritasına kitap ekle" : planId ? "Kitabı buluşmaya taşı" : "Yeni bir buluşma oluştur"}</DialogTitle><DialogDescription>{planId ? "Kitap seçildi; buluşmanın tarihini ve yerini tamamla." : "Kitabı katalogdan bulabilir veya künyeyi kendin yazabilirsin."}</DialogDescription></DialogHeader><div className="dialog-scroll">{!planId && <div className="lookup-row"><Input placeholder="Kitap adı veya ISBN ile ara" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} /><Button variant="outline" type="button" disabled={searching} onClick={() => void search()}><Search size={16} /> {searching ? "Aranıyor" : "Ara"}</Button></div>}{searchError && <p className="lookup-error">{searchError}</p>}{matches.length > 0 && <div className="lookup-results">{matches.map((match, i) => <button type="button" key={`${match.title}-${i}`} onClick={() => { setBook(match); setMatches([]); }}><span>{match.title}<small>{match.author}{match.publisher ? ` · ${match.publisher}` : ""}</small></span><Check size={17} /></button>)}</div>}<form onSubmit={submit} className="create-form"><div className="form-two"><label>Kitap adı *<Input required disabled={!!planId} value={book.title} maxLength={180} onChange={(e) => setBook({ ...book, title: e.target.value })} /></label><label>Yazar *<Input required disabled={!!planId} value={book.author} maxLength={140} onChange={(e) => setBook({ ...book, author: e.target.value })} /></label></div><div className="form-three"><label>Yayınevi<Input disabled={!!planId} value={book.publisher ?? ""} maxLength={140} onChange={(e) => setBook({ ...book, publisher: e.target.value })} /></label><label>Sayfa sayısı<Input disabled={!!planId} type="number" min="1" max="10000" value={book.pages ?? ""} onChange={(e) => setBook({ ...book, pages: e.target.value ? Number(e.target.value) : null })} /></label><label>ISBN<Input disabled={!!planId} value={book.isbn ?? ""} maxLength={20} onChange={(e) => setBook({ ...book, isbn: e.target.value })} /></label></div>{!planId && <label className="cover-field">Kapak görseli<input type="file" accept="image/jpeg,image/png,image/webp" disabled={coverBusy || busy} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setCoverBusy(true); const url = await onUpload(file); if (url) setBook((current) => ({ ...current, coverUrl: url })); setCoverBusy(false); }} />{book.coverUrl && <span>Kapak hazır ✓</span>}</label>}<div className="form-two">{(mode === "meeting" || isAdminRole(member.role)) && <label>{mode === "meeting" ? "Buluşma tarihi ve saati *" : "Planlanan tarih"}<Input name="date" type={mode === "meeting" ? "datetime-local" : "date"} required={mode === "meeting"} value={date} onChange={(e) => setDate(e.target.value)} /></label>}{mode === "meeting" && <label>Buluşma yeri *<Input name="location" required value={location} maxLength={180} placeholder="Örn. Kadıköy · kitap kafe" onChange={(e) => setLocation(e.target.value)} /></label>}</div>{mode === "meeting" && <><label>Bu buluşmada okunacak bölüm<Input name="readingScope" value={readingScope} maxLength={180} placeholder="Örn. İlk yarı · 1-160. sayfalar" onChange={(e) => setReadingScope(e.target.value)} /></label><label>Bu buluşmadan sonra<select value={bookStatus} onChange={(event) => setBookStatus(event.target.value as "continuing" | "completed")}><option value="completed">Kitap tamamlandı</option><option value="continuing">Okuma devam edecek</option></select></label><label>Harita bağlantısı<Input name="mapUrl" type="url" value={mapUrl} placeholder="https://maps.google.com/..." onChange={(e) => setMapUrl(e.target.value)} /></label></>}<label>{mode === "plan" ? "Plan notu" : "Konuşulacaklar / not"}<Textarea name="note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="İsteğe bağlı" /></label><Button className="full-button" disabled={busy || coverBusy} type="submit">{busy ? "Kaydediliyor…" : mode === "plan" ? isAdminRole(member.role) ? "Planı ekle" : "Kitabı öner" : "Buluşmayı oluştur"} <ArrowRight size={17} /></Button></form></div></DialogContent></Dialog>;
}
