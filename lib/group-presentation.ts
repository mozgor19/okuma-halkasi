import { APPLICATION_NAME, LEGACY_GROUP_NAME } from "@/lib/branding";
import { readingGroupsEnabled, resolveReadingGroup } from "@/lib/groups";

export async function groupPresentation(request: Request) {
  const enabled = readingGroupsEnabled();
  if (enabled && request.headers.has("cookie")) {
    try {
      const { group } = await resolveReadingGroup(request);
      return { name: group.name, legacy: false, group };
    } catch {
      // Never expose a group name without a current session and membership.
      // Protected pages and APIs handle selection, auth and configuration errors.
    }
  }
  return { name: enabled ? env.APPLICATION_BRAND?.trim() || APPLICATION_NAME : LEGACY_GROUP_NAME, legacy: !enabled, group: null };
}
import { env } from "cloudflare:workers";
