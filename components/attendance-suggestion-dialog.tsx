"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, ScanFace, UserCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FaceMatchCandidate } from "@/lib/face-recognition";
import type { Member } from "@/lib/types";

type AttendanceSuggestionDialogProps = {
  open: boolean;
  meetingId: number | null;
  candidates: FaceMatchCandidate[];
  faceCount: number;
  alreadyAttending: Set<number>;
  members: Member[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (memberIds: number[]) => Promise<boolean>;
};

const initials = (name: string) =>
  name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

export function AttendanceSuggestionDialog({
  open,
  meetingId,
  candidates,
  faceCount,
  alreadyAttending,
  members,
  busy,
  onOpenChange,
  onConfirm,
}: AttendanceSuggestionDialogProps) {
  const selectableIds = useMemo(
    () => candidates
      .map((candidate) => candidate.memberId)
      .filter((memberId) => !alreadyAttending.has(memberId)),
    [alreadyAttending, candidates],
  );
  const [selected, setSelected] = useState<Set<number>>(() => new Set(selectableIds));

  const confirm = async () => {
    if (!meetingId || !selected.size) return;
    const saved = await onConfirm([...selected]);
    if (saved) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="face-match-dialog">
        <DialogHeader>
          <span className="face-dialog-icon"><ScanFace size={23} /></span>
          <DialogTitle>Katılımcı önerileri</DialogTitle>
          <DialogDescription>
            Fotoğrafta {faceCount} yüz bulundu. Eklemek istediklerini kontrol edip onayla.
          </DialogDescription>
        </DialogHeader>

        <div className="face-candidate-list">
          {candidates.map((candidate) => {
            const person = members.find((member) => member.id === candidate.memberId);
            if (!person) return null;
            const isAlreadyAdded = alreadyAttending.has(person.id);
            const isSelected = selected.has(person.id);
            return (
              <label
                className={`face-candidate ${isAlreadyAdded ? "already-added" : ""}`}
                key={person.id}
              >
                <Checkbox
                  checked={isAlreadyAdded || isSelected}
                  disabled={busy || isAlreadyAdded}
                  onCheckedChange={(checked) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (checked) next.add(person.id);
                      else next.delete(person.id);
                      return next;
                    });
                  }}
                  aria-label={`${person.name} katılımcı olarak seç`}
                />
                <span className="face-candidate-avatar" style={{ backgroundColor: person.color }}>
                  {person.avatarMediaKey
                    ? <img src={`/api/media/${person.avatarMediaKey}`} alt="" />
                    : initials(person.name)}
                </span>
                <span className="face-candidate-name">
                  <strong>{person.name}</strong>
                  <small>{isAlreadyAdded ? "Zaten katılımcı" : `Eşleşme %${Math.round(candidate.score * 100)}`}</small>
                </span>
                {isAlreadyAdded && <UserCheck size={18} aria-hidden="true" />}
              </label>
            );
          })}
        </div>

        <p className="face-match-note">
          Bu sonuç yalnızca öneridir. Katılım, sen onayladıktan sonra kaydedilir.
        </p>
        <div className="face-dialog-actions">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" disabled={busy || !selected.size} onClick={() => void confirm()}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <UserCheck size={17} />}
            {selected.size ? `${selected.size} kişiyi ekle` : "Kişi seç"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
