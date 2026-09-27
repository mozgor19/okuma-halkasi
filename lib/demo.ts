import type { AppData } from "./types";

// Design-preview content only. The local database is seeded separately; nothing here is a real group record.
export const demoData: AppData = {
  members: [
    { id: 1, name: "Mustafa", role: "admin", color: "#bd8464" },
    { id: 2, name: "Deniz", role: "member", color: "#769e9a" },
    { id: 3, name: "Ece", role: "member", color: "#9881a5" },
    { id: 4, name: "Mert", role: "member", color: "#a08b65" },
    { id: 5, name: "İrem", role: "member", color: "#b37f85" },
    { id: 6, name: "Can", role: "member", color: "#6d8eaa" },
  ],
  books: [
    { id: 1, title: "Yorgunluk Toplumu", author: "Byung-Chul Han", publisher: null, pages: null, isbn: null, coverUrl: null, sourceUrl: null },
    { id: 2, title: "Siddhartha", author: "Hermann Hesse", publisher: null, pages: null, isbn: null, coverUrl: null, sourceUrl: null },
    { id: 3, title: "Kim Var İmiş Biz Burada Yoğ İken", author: "Cemal Kafadar", publisher: null, pages: null, isbn: null, coverUrl: null, sourceUrl: null },
  ],
  meetings: [{ id: 1, bookId: 1, date: "2026-10-03T15:00", location: "Buluşma yeri eklenecek", mapUrl: null, note: "Bu hafta başarı baskısını ve dinlenme fikrini konuşacağız.", createdBy: 1 }],
  attendance: [
    { meetingId: 1, memberId: 2, readingStatus: "read" },
    { meetingId: 1, memberId: 3, readingStatus: "partial" },
    { meetingId: 1, memberId: 4, readingStatus: "read" },
  ],
  reviews: [
    { meetingId: 1, memberId: 2, rating: 9, comment: "Kısacık ama uzun süre düşündürüyor.", updatedAt: "2026-09-26" },
    { meetingId: 1, memberId: 3, rating: 8, comment: "Bazı bölümlere katılmasam da sohbet açmaya çok uygun.", updatedAt: "2026-09-26" },
  ],
  photos: [],
  roadmap: [
    { id: 1, bookId: 2, plannedDate: "2026-10-10", note: "Bir sonraki durak", createdBy: 1 },
    { id: 2, bookId: 3, plannedDate: "2026-10-17", note: "Tarih haftası", createdBy: 1 },
  ],
};
