"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookHeart,
  BookOpen,
  CalendarDays,
  Camera,
  ImagePlus,
  KeyRound,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  Star,
  Trash2,
} from "@/components/icons";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readingLabels, type AppData, type Attendance, type Book, type Member } from "@/lib/types";

type ProfileViewProps = {
  data: AppData;
  member: Member;
  busy: boolean;
  onOpenMeeting: (meetingId: number) => void;
  onUploadAvatar: (file: File) => Promise<string | null>;
  onUploadFaceReference: (memberId: number, file: File) => Promise<string | null>;
  onClearFaceReference: (memberId: number) => Promise<boolean>;
  onToggleFavorite: (bookId: number, active: boolean) => Promise<void>;
  onRestoreTrash: (type: "meeting" | "plan", id: number) => Promise<void>;
  onPurgeTrash: (type: "meeting" | "plan", id: number) => Promise<void>;
  onNotice: (message: string) => void;
};

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const initials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const faceFileKey = (value: string) => value
  .toLocaleLowerCase("tr-TR")
  .replaceAll("ı", "i")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_|_$/g, "");

function ProfileAvatar({ member }: { member: Member }) {
  return (
    <span
      className="profile-avatar"
      style={{ backgroundColor: member.color }}
      aria-label={member.name}
    >
      {member.avatarMediaKey ? (
        <img src={`/api/media/${member.avatarMediaKey}`} alt="" />
      ) : (
        initials(member.name)
      )}
    </span>
  );
}

function FavoriteRow({
  book,
  active,
  busy,
  onToggle,
}: {
  book: Book;
  active: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`favorite-row ${active ? "is-favorite" : ""}`}>
      <div className="favorite-cover">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" />
        ) : (
          <BookHeart size={22} />
        )}
      </div>
      <div>
        <strong>{book.title}</strong>
        <span>{book.author}</span>
      </div>
      <button
        type="button"
        className="favorite-toggle"
        disabled={busy}
        aria-pressed={active}
        aria-label={active ? `${book.title} favorilerden çıkar` : `${book.title} favorilere ekle`}
        title={active ? "Favorilerden çıkar" : "Favorilere ekle"}
        onClick={onToggle}
      >
        <Star size={19} fill={active ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

type ReadingBookEntry = {
  book: Book;
  meetingId: number;
  date: string;
  status: Attendance["readingStatus"];
  rating: number | null;
  meetingCount: number;
  currentPage: number | null;
};

function ReadingBookRow({ entry, onOpen }: { entry: ReadingBookEntry; onOpen: () => void }) {
  return (
    <button type="button" className="reading-book-row" onClick={onOpen}>
      <span className="favorite-cover">
        {entry.book.coverUrl ? <img src={entry.book.coverUrl} alt="" /> : <BookOpen size={22} />}
      </span>
      <span className="reading-book-info">
        <strong>{entry.book.title}</strong>
        <span>{entry.book.author}</span>
        <small>
          {entry.meetingCount} buluşma · {dateFormat.format(new Date(entry.date))}
          {entry.rating !== null ? ` · ${entry.rating}/10 puan` : ""}
          {entry.currentPage !== null && entry.book.pages ? ` · ${entry.currentPage}/${entry.book.pages}. sayfa` : ""}
        </small>
      </span>
      <span className={`reading-status ${entry.status}`}>
        <i aria-hidden="true" />
        {readingLabels[entry.status]}
      </span>
      <ArrowRight size={17} aria-hidden="true" />
    </button>
  );
}

function PasswordForm({ onChanged }: { onChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Yeni şifreler eşleşmiyor.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const result = await response.json() as { error?: string };
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "Şifre değiştirilemedi.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Şifre değiştirilemedi.");
    } finally {
      setBusy(false);
    }
  }

  const validPassword =
    newPassword.length >= 12
    && /[a-zçğıöşü]/i.test(newPassword)
    && /\d/.test(newPassword);

  return (
    <section className="profile-section security-section">
      <div className="profile-section-heading">
        <span className="eyebrow">GÜVENLİK</span>
        <h2>Şifremi değiştir</h2>
        <p>Yeni şifren en az 12 karakter, bir harf ve bir rakam içermeli.</p>
      </div>
      <form className="profile-password-form" onSubmit={submit}>
        <label>
          Mevcut şifre
          <Input
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          Yeni şifre
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={200}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label>
          Yeni şifre tekrar
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={200}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button
          type="submit"
          disabled={
            busy
            || !currentPassword
            || !validPassword
            || newPassword !== confirmPassword
          }
        >
          <KeyRound size={17} />
          {busy ? "Değiştiriliyor" : "Şifreyi değiştir"}
        </Button>
      </form>
    </section>
  );
}

function FaceReferencePanel({
  data,
  member,
  busy,
  onUpload,
  onClear,
  onNotice,
}: {
  data: AppData;
  member: Member;
  busy: boolean;
  onUpload: (memberId: number, file: File) => Promise<string | null>;
  onClear: (memberId: number) => Promise<boolean>;
  onNotice: (message: string) => void;
}) {
  const [workingId, setWorkingId] = useState<number | null>(null);
  const visibleMembers = member.role === "admin"
    ? data.members.filter((person) => !person.isGuest)
    : data.members.filter((person) => person.id === member.id);

  return (
    <section className="profile-section face-reference-section">
      <div className="profile-section-heading face-reference-heading">
        <div>
          <span className="eyebrow">YÜZ EŞLEŞTİRME</span>
          <h2>Referans fotoğrafları</h2>
          <p>Referanslar korumalı alanda tutulur; eşleştirme yalnızca cihazında yapılır.</p>
        </div>
        <div className="face-heading-actions">
          <span className="local-processing"><ShieldCheck size={17} /> Tarayıcıda işlenir</span>
          {member.role === "admin" && (
            <label className={`face-bulk-upload ${workingId !== null || busy ? "disabled" : ""}`}>
              <ImagePlus size={16} /> Toplu aktar
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={workingId !== null || busy}
                onChange={async (event) => {
                  const files = [...(event.target.files ?? [])];
                  event.target.value = "";
                  if (!files.length) return;
                  const assignments = files.map((file) => {
                    const key = faceFileKey(file.name.replace(/\.[^.]+$/, ""));
                    return { file, person: data.members.find((candidate) => !candidate.isGuest && faceFileKey(candidate.name) === key) };
                  });
                  const matched = assignments.filter((entry): entry is { file: File; person: Member } => Boolean(entry.person));
                  if (!matched.length) {
                    onNotice("Dosya adları üyelerle eşleşmedi.");
                    return;
                  }
                  setWorkingId(-1);
                  let uploaded = 0;
                  for (const assignment of matched) {
                    if (await onUpload(assignment.person.id, assignment.file)) uploaded += 1;
                  }
                  setWorkingId(null);
                  const unmatched = files.length - matched.length;
                  onNotice(`${uploaded} yüz referansı aktarıldı${unmatched ? `; ${unmatched} dosya adı eşleşmedi` : ""}.`);
                }}
              />
            </label>
          )}
        </div>
      </div>
      <div className="face-reference-grid">
        {visibleMembers.map((person) => {
          const active = person.faceRecognitionConsent && person.faceReferenceMediaKey;
          const working = workingId === person.id;
          return (
            <div className="face-reference-row" key={person.id}>
              <span className="face-reference-preview" style={{ backgroundColor: person.color }}>
                {person.faceReferenceMediaKey
                  ? <img src={`/api/media/${person.faceReferenceMediaKey}`} alt="" />
                  : <ScanFace size={25} />}
              </span>
              <span className="face-reference-person">
                <strong>{person.name}</strong>
                <small className={active ? "reference-active" : ""}>
                  {active ? "Referans etkin" : "Referans yok"}
                </small>
              </span>
              <label className={`face-reference-upload ${working || busy ? "disabled" : ""}`}>
                <ImagePlus size={16} />
                {active ? "Değiştir" : "Ekle"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={working || busy}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setWorkingId(person.id);
                    const uploaded = await onUpload(person.id, file);
                    setWorkingId(null);
                    if (uploaded) onNotice(`${person.name} için yüz referansı kaydedildi.`);
                  }}
                />
              </label>
              {active && (
                <button
                  type="button"
                  className="face-reference-remove"
                  disabled={working || busy}
                  aria-label={`${person.name} yüz referansını kaldır`}
                  title="Yüz referansını kaldır"
                  onClick={async () => {
                    setWorkingId(person.id);
                    const removed = await onClear(person.id);
                    setWorkingId(null);
                    if (removed) onNotice(`${person.name} için yüz referansı kaldırıldı.`);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ProfileView({
  data,
  member,
  busy,
  onOpenMeeting,
  onUploadAvatar,
  onUploadFaceReference,
  onClearFaceReference,
  onToggleFavorite,
  onRestoreTrash,
  onPurgeTrash,
  onNotice,
}: ProfileViewProps) {
  const [avatarBusy, setAvatarBusy] = useState(false);
  const attendedIds = useMemo(
    () => new Set(
      data.attendance
        .filter((entry) => entry.memberId === member.id)
        .map((entry) => entry.meetingId),
    ),
    [data.attendance, member.id],
  );
  const attendedMeetings = useMemo(
    () =>
      data.meetings
        .filter((meeting) => attendedIds.has(meeting.id))
        .sort((left, right) => right.date.localeCompare(left.date)),
    [attendedIds, data.meetings],
  );
  const galleryPhotos = useMemo(
    () => data.photos.filter((photo) => attendedIds.has(photo.meetingId)),
    [attendedIds, data.photos],
  );
  const myReviews = data.reviews.filter((review) => review.memberId === member.id);
  const average = myReviews.length
    ? (myReviews.reduce((sum, review) => sum + review.rating, 0) / myReviews.length)
      .toFixed(1)
      .replace(".", ",")
    : "-";
  const favoriteIds = new Set(
    data.favorites
      .filter((favorite) => favorite.memberId === member.id)
      .map((favorite) => favorite.bookId),
  );
  const favoriteBooks = data.books
    .filter((book) => favoriteIds.has(book.id))
    .sort((left, right) => left.title.localeCompare(right.title, "tr"));
  const readingBooks = useMemo(() => {
    const entries = new Map<number, ReadingBookEntry>();
    for (const meeting of attendedMeetings) {
      const book = data.books.find((item) => item.id === meeting.bookId);
      const attendance = data.attendance.find(
        (item) => item.meetingId === meeting.id && item.memberId === member.id,
      );
      if (!book || !attendance) continue;
      const review = data.reviews.find(
        (item) => item.meetingId === meeting.id && item.memberId === member.id,
      );
      const existing = entries.get(book.id);
      if (!existing) {
        entries.set(book.id, {
          book,
          meetingId: meeting.id,
          date: meeting.date,
          status: attendance.readingStatus,
          rating: review?.rating ?? null,
          meetingCount: 1,
          currentPage: attendance.currentPage,
        });
        continue;
      }
      existing.meetingCount += 1;
      if (existing.status === "unselected" && attendance.readingStatus !== "unselected") {
        existing.status = attendance.readingStatus;
      }
      if (existing.rating === null && review) existing.rating = review.rating;
      if (existing.currentPage === null && attendance.currentPage !== null) existing.currentPage = attendance.currentPage;
    }
    return [...entries.values()];
  }, [attendedMeetings, data.attendance, data.books, data.reviews, member.id]);

  return (
    <div className="profile-page">
      <section className="profile-header">
        <div className="profile-identity">
          <ProfileAvatar member={member} />
          <div>
            <span className="eyebrow">PROFİLİM</span>
            <h1>{member.name}</h1>
            <p>{member.role === "admin" ? "Yönetici" : "Üye"}</p>
          </div>
        </div>
        <label className={`profile-photo-button ${avatarBusy ? "disabled" : ""}`}>
          <ImagePlus size={17} />
          Fotoğrafı değiştir
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={avatarBusy || busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setAvatarBusy(true);
              const uploaded = await onUploadAvatar(file);
              setAvatarBusy(false);
              if (uploaded) onNotice("Profil fotoğrafın güncellendi.");
            }}
          />
        </label>
      </section>

      <Tabs defaultValue="overview" className="profile-tabs">
        <TabsList variant="line" aria-label="Profil bölümleri">
          <TabsTrigger value="overview">Özet</TabsTrigger>
          <TabsTrigger value="gallery">Fotoğraflarım</TabsTrigger>
          <TabsTrigger value="books">Kitaplarım</TabsTrigger>
          <TabsTrigger value="face">Yüz verisi</TabsTrigger>
          <TabsTrigger value="security">Güvenlik</TabsTrigger>
          {member.role === "admin" && <TabsTrigger value="trash">Çöp kutusu</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <section className="profile-stats" aria-label="Okuma istatistikleri">
            <div><strong>{attendedMeetings.length}</strong><span>katıldığı buluşma</span></div>
            <div><strong>{myReviews.length}</strong><span>değerlendirme</span></div>
            <div><strong>{average}</strong><span>ortalama puan</span></div>
            <div><strong>{favoriteBooks.length}</strong><span>favori kitap</span></div>
          </section>
          <section className="profile-section">
            <div className="profile-section-heading">
              <span className="eyebrow">KAYITLARIM</span>
              <h2>Katıldığım buluşmalar</h2>
            </div>
            <div className="profile-meeting-list">
              {attendedMeetings.map((meeting) => {
                const book = data.books.find((item) => item.id === meeting.bookId);
                if (!book) return null;
                return (
                  <button
                    type="button"
                    key={meeting.id}
                    onClick={() => onOpenMeeting(meeting.id)}
                  >
                    <CalendarDays size={18} />
                    <span>
                      <strong>{book.title}</strong>
                      <small>{dateFormat.format(new Date(meeting.date))}</small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                );
              })}
              {!attendedMeetings.length && (
                <div className="profile-empty">
                  Henüz katıldığın bir buluşma kaydı yok.
                </div>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="gallery">
          <section className="profile-section">
            <div className="profile-section-heading">
              <span className="eyebrow">GALERİM</span>
              <h2>Katıldığım buluşmalardan</h2>
              <p>Katılım kaydın bulunan etkinliklerdeki fotoğraflar burada görünür.</p>
            </div>
            {galleryPhotos.length ? (
              <div className="profile-gallery">
                {galleryPhotos.map((photo) => {
                  const meeting = data.meetings.find((item) => item.id === photo.meetingId);
                  const book = meeting
                    ? data.books.find((item) => item.id === meeting.bookId)
                    : undefined;
                  return (
                    <PhotoLightbox
                      key={photo.id}
                      src={`/api/media/${photo.mediaKey}`}
                      alt={book ? `${book.title} buluşmasından fotoğraf` : "Buluşma fotoğrafı"}
                      caption={book?.title ?? "Buluşma"}
                      detail={meeting ? dateFormat.format(new Date(meeting.date)) : undefined}
                      action={{
                        label: "Buluşmayı aç",
                        onSelect: () => onOpenMeeting(photo.meetingId),
                      }}
                    >
                      <span>
                        <strong>{book?.title ?? "Buluşma"}</strong>
                        {meeting && <small>{dateFormat.format(new Date(meeting.date))}</small>}
                      </span>
                    </PhotoLightbox>
                  );
                })}
              </div>
            ) : (
              <div className="profile-empty gallery-profile-empty">
                <Camera size={28} />
                Katıldığın buluşmalarda henüz fotoğraf yok.
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="books">
          <Tabs defaultValue="favorites" className="books-tabs">
            <TabsList className="books-tabs-list" aria-label="Kitap listeleri">
              <TabsTrigger value="favorites">
                <Star size={15} /> Favorilerim <small>{favoriteBooks.length}</small>
              </TabsTrigger>
              <TabsTrigger value="reading">
                <BookOpen size={15} /> Okuduklarım <small>{readingBooks.length}</small>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="favorites" className="books-tab-content">
              <section className="profile-section">
                <div className="profile-section-heading">
                  <span className="eyebrow">FAVORİLERİM</span>
                  <h2>Yıldızladığım kitaplar</h2>
                  <p>Favoriye eklediğin kitaplar yalnızca burada görünür.</p>
                </div>
                {favoriteBooks.length ? (
                  <div className="favorite-list">
                    {favoriteBooks.map((book) => (
                      <FavoriteRow
                        key={book.id}
                        book={book}
                        active
                        busy={busy}
                        onToggle={() => void onToggleFavorite(book.id, false)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="profile-empty">
                    <Star size={25} />
                    Henüz yıldızladığın bir kitap yok.
                  </div>
                )}
              </section>
            </TabsContent>
            <TabsContent value="reading" className="books-tab-content">
              <section className="profile-section">
                <div className="profile-section-heading">
                  <span className="eyebrow">OKUDUKLARIM</span>
                  <h2>Buluşmalardaki kitaplarım</h2>
                  <p>Renkli nokta, en son belirttiğin okuma durumunu gösterir.</p>
                </div>
                {readingBooks.length ? (
                  <div className="reading-book-list">
                    {readingBooks.map((entry) => (
                      <ReadingBookRow
                        key={entry.book.id}
                        entry={entry}
                        onOpen={() => onOpenMeeting(entry.meetingId)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="profile-empty">
                    <BookOpen size={25} />
                    Henüz katıldığın bir buluşma kitabı yok.
                  </div>
                )}
              </section>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="face">
          <FaceReferencePanel
            data={data}
            member={member}
            busy={busy}
            onUpload={onUploadFaceReference}
            onClear={onClearFaceReference}
            onNotice={onNotice}
          />
        </TabsContent>

        {member.role === "admin" && (
          <TabsContent value="trash">
            <section className="profile-section">
              <div className="profile-section-heading">
                <span className="eyebrow">ÇÖP KUTUSU</span>
                <h2>Silinen kayıtlar</h2>
                <p>Buluşmaları ve kitap adaylarını geri alabilir veya kalıcı olarak silebilirsin.</p>
              </div>
              <div className="trash-list">
                {data.trash.map((item) => {
                  const book = data.books.find((entry) => entry.id === item.bookId);
                  return (
                    <div className="trash-row" key={`${item.type}-${item.id}`}>
                      <span className="trash-icon"><Trash2 size={18} /></span>
                      <span>
                        <strong>{book?.title ?? "Silinen kayıt"}</strong>
                        <small>{item.type === "meeting" ? "Buluşma" : "Kitap adayı"} · {dateFormat.format(new Date(item.deletedAt))}</small>
                      </span>
                      <button type="button" title="Geri al" aria-label="Kaydı geri al" disabled={busy} onClick={() => void onRestoreTrash(item.type, item.id)}><RotateCcw size={17} /></button>
                      <button type="button" className="purge-button" title="Kalıcı sil" aria-label="Kaydı kalıcı sil" disabled={busy} onClick={() => {
                        if (window.confirm("Bu kayıt ve bağlı verileri kalıcı olarak silinsin mi? Bu işlem geri alınamaz.")) void onPurgeTrash(item.type, item.id);
                      }}><Trash2 size={17} /></button>
                    </div>
                  );
                })}
                {!data.trash.length && <div className="profile-empty">Çöp kutusu boş.</div>}
              </div>
            </section>
          </TabsContent>
        )}

        <TabsContent value="security">
          <PasswordForm
            onChanged={() => onNotice("Şifren değiştirildi. Diğer oturumlar kapatıldı.")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
