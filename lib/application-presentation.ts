import { env } from "cloudflare:workers";
import { APPLICATION_NAME, LEGACY_APPLICATION_NAME } from "@/lib/branding";
import { readingGroupsEnabled } from "@/lib/groups";
import { brandPublicOrigin, KORU_BRAND } from "@/lib/brand-identity";

export function applicationPresentation() {
  const name = readingGroupsEnabled() ? env.APPLICATION_BRAND?.trim() || APPLICATION_NAME : LEGACY_APPLICATION_NAME;
  return { name, koru: name === KORU_BRAND.name, origin: brandPublicOrigin(env.AUTH_PUBLIC_ORIGIN) };
}
