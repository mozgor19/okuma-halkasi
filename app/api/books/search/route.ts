export const runtime = "edge";
type OpenBook = { title?: string; author_name?: string[]; publisher?: string[]; number_of_pages_median?: number; isbn?: string[]; cover_i?: number; key?: string };
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 100) return Response.json({ error: "En az üç karakter yaz." }, { status: 400 });
  try {
    const endpoint = new URL("https://openlibrary.org/search.json");
    endpoint.searchParams.set(/^\d{10,13}$/.test(query.replace(/[- ]/g, "")) ? "isbn" : "title", query);
    endpoint.searchParams.set("fields", "key,title,author_name,publisher,number_of_pages_median,isbn,cover_i");
    endpoint.searchParams.set("limit", "5");
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "OkumaHalkasi/1.0 (book club metadata search)" } });
    if (!response.ok) throw new Error(`Open Library ${response.status}`);
    const result = await response.json() as { docs?: OpenBook[] };
    return Response.json({ books: (result.docs ?? []).filter((book) => book.title).map((book) => ({
      title: book.title!, author: book.author_name?.[0] ?? "", publisher: book.publisher?.[0] ?? null,
      pages: book.number_of_pages_median ?? null, isbn: book.isbn?.[0] ?? null,
      coverUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null,
      sourceUrl: book.key?.startsWith("/") ? `https://openlibrary.org${book.key}` : null,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Book lookup failed", error); return Response.json({ error: "Kitap kataloğuna ulaşılamadı." }, { status: 502 }); }
}
