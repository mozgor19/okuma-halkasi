"use client";

import { UserSwitch } from "@/components/icons";
import { groupsPath, useReadingGroup } from "@/lib/group-client";

export function ReadingGroupSwitcher({ disabled = false }: { disabled?: boolean }) {
  const group = useReadingGroup();
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
    </section>
  );
}
