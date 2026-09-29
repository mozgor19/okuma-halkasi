"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookHeart,
  CalendarDays,
  Camera,
  ImagePlus,
  KeyRound,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppData, Book, Member } from "@/lib/types";

type ProfileViewProps = {
  data: AppData;
  member: Member;
  busy: boolean;
  onOpenMeeting: (meetingId: number) => void;
  onUploadAvatar: (file: File) => Promise<string | null>;
  onToggleFavorite: (bookId: number, active: boolean) => Promise<void>;
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

export function ProfileView({
  data,
  member,
  busy,
  onOpenMeeting,
  onUploadAvatar,
  onToggleFavorite,
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
  const favoriteBooks = data.books.filter((book) => favoriteIds.has(book.id));
  const sortedBooks = [...data.books].sort((left, right) =>
    Number(favoriteIds.has(right.id)) - Number(favoriteIds.has(left.id))
    || left.title.localeCompare(right.title, "tr")
  );

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
          <TabsTrigger value="favorites">Favorilerim</TabsTrigger>
          <TabsTrigger value="security">Güvenlik</TabsTrigger>
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
                    <button
                      type="button"
                      key={photo.id}
                      onClick={() => onOpenMeeting(photo.meetingId)}
                    >
                      <img
                        src={`/api/media/${photo.mediaKey}`}
                        alt={book ? `${book.title} buluşmasından fotoğraf` : "Buluşma fotoğrafı"}
                      />
                      <span>
                        <strong>{book?.title ?? "Buluşma"}</strong>
                        {meeting && <small>{dateFormat.format(new Date(meeting.date))}</small>}
                      </span>
                    </button>
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

        <TabsContent value="favorites">
          <section className="profile-section">
            <div className="profile-section-heading">
              <span className="eyebrow">KİTAPLIĞIM</span>
              <h2>Favorilerim</h2>
              <p>Yıldız düğmesiyle kitapları kendi listene ekleyip çıkarabilirsin.</p>
            </div>
            <div className="favorite-list">
              {sortedBooks.map((book) => (
                <FavoriteRow
                  key={book.id}
                  book={book}
                  active={favoriteIds.has(book.id)}
                  busy={busy}
                  onToggle={() => {
                    void onToggleFavorite(book.id, !favoriteIds.has(book.id));
                  }}
                />
              ))}
              {!sortedBooks.length && (
                <div className="profile-empty">Henüz kayıtlı kitap yok.</div>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="security">
          <PasswordForm
            onChanged={() => onNotice("Şifren değiştirildi. Diğer oturumlar kapatıldı.")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
