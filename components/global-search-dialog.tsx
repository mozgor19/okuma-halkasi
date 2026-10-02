"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, Compass, Search } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AppData } from "@/lib/types";

type SearchResult = {
  key: string;
  title: string;
  detail: string;
  kind: "meeting" | "plan";
  id: number;
};

const normalize = (value: string) =>
  value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function GlobalSearchDialog({
  data,
  open,
  onOpenChange,
  onOpenMeeting,
  onOpenRoadmap,
}: {
  data: AppData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenMeeting: (meetingId: number) => void;
  onOpenRoadmap: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onOpenChange]);

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    if (needle.length < 2) return [];
    const found: SearchResult[] = [];

    for (const meeting of data.meetings) {
      const book = data.books.find((item) => item.id === meeting.bookId);
      if (!book) continue;
      const reviewText = data.reviews
        .filter((review) => review.meetingId === meeting.id)
        .map((review) => {
          const person = data.members.find((member) => member.id === review.memberId);
          return `${person?.name ?? ""} ${review.comment ?? ""}`;
        })
        .join(" ");
      const haystack = normalize([
        book.title,
        book.author,
        book.publisher,
        meeting.location,
        meeting.note,
        meeting.readingScope,
        meeting.date,
        reviewText,
      ].filter(Boolean).join(" "));
      if (haystack.includes(needle)) {
        found.push({
          key: `meeting-${meeting.id}`,
          title: book.title,
          detail: `${book.author} · ${new Date(meeting.date).toLocaleDateString("tr-TR")} · ${meeting.location}`,
          kind: "meeting",
          id: meeting.id,
        });
      }
    }

    for (const plan of data.roadmap) {
      const book = data.books.find((item) => item.id === plan.bookId);
      if (!book) continue;
      const haystack = normalize([book.title, book.author, book.publisher, plan.note, plan.plannedDate].filter(Boolean).join(" "));
      if (haystack.includes(needle)) {
        found.push({
          key: `plan-${plan.id}`,
          title: book.title,
          detail: `${book.author} · Gelecek kitap`,
          kind: "plan",
          id: plan.id,
        });
      }
    }

    return found.slice(0, 14);
  }, [data, query]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) setQuery(""); onOpenChange(nextOpen); }}>
      <DialogContent className="global-search-dialog">
        <DialogHeader>
          <DialogTitle>Kayıtlarda ara</DialogTitle>
          <DialogDescription>Kitap, yazar, yer, tarih, not, yorum veya kişi adıyla ara.</DialogDescription>
        </DialogHeader>
        <div className="global-search-input">
          <Search size={18} />
          <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="En az iki karakter yaz" />
        </div>
        <div className="global-search-results">
          {results.map((result) => (
            <button type="button" key={result.key} onClick={() => {
              onOpenChange(false);
              if (result.kind === "meeting") onOpenMeeting(result.id);
              else onOpenRoadmap();
            }}>
              <span className="search-result-icon">{result.kind === "meeting" ? <CalendarDays size={18} /> : <Compass size={18} />}</span>
              <span><strong>{result.title}</strong><small>{result.detail}</small></span>
            </button>
          ))}
          {query.trim().length >= 2 && !results.length && <div className="search-empty"><BookOpen size={24} /> Eşleşen kayıt bulunamadı.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
