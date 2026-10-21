import { domainDatabase } from "@/db/database";

export async function groupHeroKey() {
  return (await domainDatabase().read("SELECT s.value FROM club_settings s JOIN media m ON m.media_key=s.value WHERE s.key='group_hero_media_key'").first<{ value: string }>())?.value ?? null;
}
export async function removeUnusedHero(key: string | null) {
  if (!key) return;
  try { await domainDatabase().delete("media", `media_key=?
    AND NOT EXISTS(SELECT 1 FROM club_settings WHERE key='group_hero_media_key' AND value=?)
    AND NOT EXISTS(SELECT 1 FROM photos WHERE media_key=?)
    AND NOT EXISTS(SELECT 1 FROM members WHERE avatar_media_key=? OR face_reference_media_key=?)
    AND NOT EXISTS(SELECT 1 FROM books WHERE cover_url=?)`).bind(key, key, key, key, key, "/api/media/" + key).run();
  } catch {
    // The image/settings transaction already committed. Retain media rather than
    // misreport a successful replacement or risk an old-schema reference.
    console.error("Group image cleanup deferred; private details withheld");
  }
}
