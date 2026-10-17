"use client";

import { UserSwitch } from "@/components/icons";
import { groupsPath, useReadingGroup } from "@/lib/group-client";
import { useOnboardingConfig } from "@/components/onboarding";
import { GroupInvitations } from "@/components/group-invitations";

export function ReadingGroupSwitcher({ disabled = false, isAdmin = false }: { disabled?: boolean; isAdmin?: boolean }) {
  const group = useReadingGroup();
  const onboarding = useOnboardingConfig();
  if (!group) return null;
  return (
    <section className="profile-section" aria-label="Okuma grubu">
      <div className="profile-section-heading">
        <span className="eyebrow">OKUMA GRUBUM</span>
        <h2 className="break-words">{group.name}</h2>
      </div>
      <button type="button" className="profile-photo-button" disabled={disabled}
        onClick={() => { window.location.assign(groupsPath("/")); }}>
        <UserSwitch size={17} /> Grup değiştir
      </button>
      {onboarding?.enabled && <><a className="small-link onboarding-command" href="/groups/manage">Gruplarımı yönet · Grup kur veya katıl</a>{isAdmin && <GroupInvitations groupId={group.id} disabled={disabled} />}</>}
    </section>
  );
}
