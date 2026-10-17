"use client";

import { useState, type FormEvent } from "react";
import { Share, Trash2, Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Invitation = { id: string; expiresAt: number; maxUses: number; uses: number; revokedAt: number | null };
export function GroupInvitations({ groupId, disabled }: { groupId: string; disabled: boolean }) {
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  async function load() {
    try {
      const response = await fetch("/api/onboarding/invitations", { cache: "no-store", headers: { "X-Reading-Group": groupId } });
      const result = await response.json() as { invitations: Invitation[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Davetler yüklenemedi.");
      setInvitations(result.invitations);
      setCheckedAt(Date.now());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Davetler yüklenemedi."); }
  }
  async function command(action: "invitations" | "revoke-invitation", body: object) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/onboarding/${action}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Reading-Group": groupId }, body: JSON.stringify(body) });
      const result = await response.json() as { token?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Davet işlemi tamamlanamadı.");
      if (result.token) { setToken(result.token); setCopied(false); }
      else setToken("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Davet işlemi tamamlanamadı."); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void command("invitations", { days: Number(form.get("days")), maxUses: Number(form.get("maxUses")) });
  }
  return <details className="group-invitations" onToggle={(event) => { if (event.currentTarget.open && !invitations) void load(); }}>
    <summary>Davetleri yönet</summary>
    {error && <p role="alert">{error}</p>}
    <form className="invitation-form" onSubmit={create}>
      <label>Geçerlilik (gün)<Input name="days" type="number" min={1} max={30} defaultValue={7} required /></label>
      <label>Kişi sınırı<Input name="maxUses" type="number" min={1} max={100} defaultValue={10} required /></label>
      <Button type="submit" disabled={disabled || busy}><Plus size={17} /> Davet oluştur</Button>
    </form>
    {token && <div className="invitation-result"><label htmlFor="created-invitation">Davet bağlantısı</label><Input id="created-invitation" readOnly value={`${location.origin}/join#invite=${token}`} onFocus={(event) => event.target.select()} /><Button variant="outline" type="button" onClick={() => { void navigator.clipboard.writeText(`${location.origin}/join#invite=${token}`).then(() => setCopied(true)).catch(() => setError("Bağlantı kopyalanamadı. Alanı seçerek kopyalayabilirsin.")); }}><Share size={16} /> {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}</Button></div>}
    <ul className="invitation-list">{invitations?.map((invite) => <li key={invite.id}><span>{invite.uses}/{invite.maxUses} kişi · {new Date(invite.expiresAt).toLocaleDateString("tr-TR")}<small>{invite.revokedAt ? "İptal edildi" : invite.expiresAt < checkedAt ? "Süresi doldu" : "Aktif"}</small></span><button type="button" className="profile-photo-button" title="Daveti iptal et" aria-label="Daveti iptal et" disabled={disabled || busy || !!invite.revokedAt} onClick={() => void command("revoke-invitation", { id: invite.id })}><Trash2 size={17} /></button></li>)}</ul>
  </details>;
}
