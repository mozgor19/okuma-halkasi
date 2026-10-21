"use client";

import { Computer, MapPin } from "@/components/icons";
import { Input } from "@/components/ui/input";
import type { Meeting } from "@/lib/types";
import type { MeetingKind } from "@/lib/meeting-details";

export type VenueDraft = { kind: MeetingKind; location: string; mapUrl: string; onlineUrl: string };
export function venueDraft(meeting?: Meeting): VenueDraft {
  return { kind: meeting?.kind ?? "in_person", location: meeting?.kind === "online" ? "" : meeting?.location ?? "",
    mapUrl: meeting?.mapUrl ?? "", onlineUrl: meeting?.onlineUrl ?? "" };
}
export function MeetingVenueFields({ value, onChange, enabled, disabled = false }: {
  value: VenueDraft; onChange(value: VenueDraft): void; enabled: boolean; disabled?: boolean;
}) {
  return <div className="meeting-venue-fields">
    {enabled && <fieldset className="venue-choice" disabled={disabled}><legend>Buluşma biçimi</legend><div>
      {([['in_person', 'Yüz yüze', MapPin], ['online', 'Çevrim içi', Computer]] as const).map(([kind, label, Icon]) =>
        <label key={kind} data-selected={value.kind === kind}><input type="radio" name="meeting-kind" value={kind} checked={value.kind === kind}
          onChange={() => onChange({ ...value, kind })} /><Icon size={18} aria-hidden="true" /><span>{label}</span></label>)}
    </div></fieldset>}
    {value.kind === "online" && enabled
      ? <label>Toplantı bağlantısı <span className="optional-label">İsteğe bağlı</span><Input name="onlineUrl" type="url" pattern="https://.+" title="https:// ile başlayan bir bağlantı gir." maxLength={2048} disabled={disabled}
        placeholder="https://meet.google.com/..." value={value.onlineUrl} onChange={(event) => onChange({ ...value, onlineUrl: event.target.value })} /></label>
      : <><label>Buluşma yeri *<Input name="location" required maxLength={180} disabled={disabled} value={value.location}
        placeholder="Örn. Kadıköy · kitap kafe" onChange={(event) => onChange({ ...value, location: event.target.value })} /></label>
        <label>Harita bağlantısı<Input name="mapUrl" type="url" maxLength={2048} disabled={disabled} placeholder="https://maps.google.com/..."
          value={value.mapUrl} onChange={(event) => onChange({ ...value, mapUrl: event.target.value })} /></label></>}
  </div>;
}

export function MeetingOnlineLink({ meeting }: { meeting: Meeting }) {
  if (meeting.kind !== "online") return null;
  return <div className="meeting-online-access"><Computer size={19} aria-hidden="true" /><span>Çevrim içi buluşma</span>
    {meeting.onlineUrl && <a href={meeting.onlineUrl} target="_blank" rel="noopener noreferrer" className="group-command">Toplantıya katıl</a>}
  </div>;
}
