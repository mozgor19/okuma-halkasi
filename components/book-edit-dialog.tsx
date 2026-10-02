"use client";

import { useState, type FormEvent } from "react";
import { ImagePlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Book } from "@/lib/types";

type BookDraft = Omit<Book, "id">;

export function BookEditDialog({
  book,
  open,
  busy,
  onClose,
  onSubmit,
  onUpload,
}: {
  book?: Book;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (bookId: number, book: BookDraft) => Promise<void>;
  onUpload: (file: File) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<BookDraft>(() => book ? {
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    pages: book.pages,
    isbn: book.isbn,
    coverUrl: book.coverUrl,
    sourceUrl: book.sourceUrl,
  } : {
    title: "",
    author: "",
    publisher: null,
    pages: null,
    isbn: null,
    coverUrl: null,
    sourceUrl: null,
  });
  const [coverBusy, setCoverBusy] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (book) void onSubmit(book.id, draft);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="create-dialog">
        <DialogHeader>
          <DialogTitle>Kitap künyesini düzenle</DialogTitle>
          <DialogDescription>
            Değişiklikler aynı kitabı kullanan bütün buluşmalara yansır.
          </DialogDescription>
        </DialogHeader>
        {book && (
          <form className="create-form" onSubmit={submit}>
            <div className="form-two">
              <label>
                Kitap adı *
                <Input required maxLength={180} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
              </label>
              <label>
                Yazar *
                <Input required maxLength={140} value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} />
              </label>
            </div>
            <div className="form-three">
              <label>
                Yayınevi
                <Input maxLength={140} value={draft.publisher ?? ""} onChange={(event) => setDraft({ ...draft, publisher: event.target.value })} />
              </label>
              <label>
                Sayfa sayısı
                <Input type="number" min="1" max="10000" value={draft.pages ?? ""} onChange={(event) => setDraft({ ...draft, pages: event.target.value ? Number(event.target.value) : null })} />
              </label>
              <label>
                ISBN
                <Input maxLength={20} value={draft.isbn ?? ""} onChange={(event) => setDraft({ ...draft, isbn: event.target.value })} />
              </label>
            </div>
            <label>
              Kaynak bağlantısı
              <Input type="url" value={draft.sourceUrl ?? ""} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} placeholder="https://openlibrary.org/works/..." />
            </label>
            <label className="cover-field">
              <span><ImagePlus size={16} /> Kapak görseli</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={coverBusy || busy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setCoverBusy(true);
                  const url = await onUpload(file);
                  if (url) setDraft((current) => ({ ...current, coverUrl: url }));
                  setCoverBusy(false);
                }}
              />
              {draft.coverUrl && <small>Kapak hazır</small>}
            </label>
            <Button type="submit" disabled={busy || coverBusy} className="full-button">
              Künyeyi kaydet
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
