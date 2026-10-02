"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Book, Meeting } from "@/lib/types";

export function ContinuationDialog({
  book,
  previousMeeting,
  open,
  busy,
  onClose,
  onSubmit,
}: {
  book?: Book;
  previousMeeting?: Meeting;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [location, setLocation] = useState(previousMeeting?.location ?? "");
  const [mapUrl, setMapUrl] = useState(previousMeeting?.mapUrl ?? "");
  const [readingScope, setReadingScope] = useState("");
  const [bookStatus, setBookStatus] = useState<"continuing" | "completed">("completed");
  const [note, setNote] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!book) return;
    void onSubmit({
      bookId: book.id,
      date,
      location,
      mapUrl,
      readingScope,
      bookStatus,
      note,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="create-dialog">
        <DialogHeader>
          <DialogTitle>Devam buluşması oluştur</DialogTitle>
          <DialogDescription>
            {book
              ? `${book.title} için aynı kitap kaydı kullanılacak; yeni künye oluşturulmayacak.`
              : "Aynı kitap kaydıyla yeni bir buluşma oluştur."}
          </DialogDescription>
        </DialogHeader>
        <form className="create-form" onSubmit={submit}>
          <div className="form-two">
            <label>
              Buluşma tarihi ve saati *
              <Input type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              Buluşma yeri *
              <Input required maxLength={180} value={location} onChange={(event) => setLocation(event.target.value)} />
            </label>
          </div>
          <label>
            Bu buluşmada okunacak bölüm
            <Input maxLength={180} value={readingScope} onChange={(event) => setReadingScope(event.target.value)} placeholder="Örn. İkinci yarı · 161-320. sayfalar" />
          </label>
          <label>
            Bu buluşmadan sonra
            <select value={bookStatus} onChange={(event) => setBookStatus(event.target.value as "continuing" | "completed")}>
              <option value="completed">Kitap tamamlandı</option>
              <option value="continuing">Okuma devam edecek</option>
            </select>
          </label>
          <label>
            Harita bağlantısı
            <Input type="url" value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} placeholder="https://maps.google.com/..." />
          </label>
          <label>
            Konuşulacaklar / not
            <Textarea maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button className="full-button" disabled={busy || !book} type="submit">
            Devam buluşmasını oluştur <ArrowRight size={17} />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
