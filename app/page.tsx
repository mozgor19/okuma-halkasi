import { headers } from "next/headers";
import ReadingApp from "@/components/reading-app";
import { applicationPresentation } from "@/lib/application-presentation";
import { GET as authorizedState } from "@/app/api/state/route";
import type { AppData } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let initialData: AppData | null = null;
  if (applicationPresentation().koru) {
    const incoming = await headers();
    const params = await searchParams;
    const url = new URL("https://snapshot.invalid/api/state");
    const group = params.group;
    for (const value of typeof group === "string" ? [group] : group || []) url.searchParams.append("group", value);
    // Reuse the API's authentication, group context and private-field filters.
    // No internal HTTP call, static cache, or alternate authorization path.
    const response = await authorizedState(new Request(url, { headers: incoming }));
    if (response.ok) initialData = await response.json() as AppData;
  }
  return <ReadingApp initialData={initialData} />;
}
