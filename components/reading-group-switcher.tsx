"use client";

import { BookOpen, UserSwitch } from "@/components/icons";
import { groupsPath, useReadingGroup } from "@/lib/group-client";
import { useOnboardingConfig } from "@/components/onboarding";
import { GroupInvitations } from "@/components/group-invitations";
import { Button } from "@/components/ui/button";
import { MeetingMailPreference } from "@/components/meeting-mail-preference";

export function ReadingGroupSwitcher({ disabled = false, isAdmin = false }: { disabled?: boolean; isAdmin?: boolean }) {
  const group = useReadingGroup();
  const onboarding = useOnboardingConfig();
  if (!group) return null;
  return (
    <section className="profile-section reading-group-section" aria-label="Okuma grubu">
      <div className="reading-group-heading">
        <div className="profile-section-heading">
          <span className="eyebrow">OKUMA GRUBUM</span>
          <h2 className="break-words">{group.name}</h2>
        </div>
        <div className="reading-group-commands" aria-label="Okuma grubu işlemleri">
          <Button type="button" variant="outline" className="group-command" disabled={disabled}
            onClick={() => { window.location.assign(groupsPath("/")); }}>
            <UserSwitch size={18} aria-hidden="true" /> Grup değiştir
          </Button>
          {onboarding?.enabled && <Button variant="outline" className="group-command" asChild>
            <a href="/groups/manage" aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault(); }}><BookOpen size={18} aria-hidden="true" /> Grupları yönet</a>
          </Button>}
        </div>
      </div>
      {onboarding?.enabled && isAdmin && <GroupInvitations key={group.id} groupId={group.id} disabled={disabled} />}
      {onboarding?.enabled && <MeetingMailPreference key={group.id + "-mail"} />}
    </section>
  );
}
