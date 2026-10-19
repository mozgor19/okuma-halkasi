"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, ChevronDown, Copy, Trash2, Plus, UserPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Invitation = { id: string; expiresAt: number; maxUses: number; uses: number; revokedAt: number | null };
export function GroupInvitations({ groupId, disabled }: { groupId: string; disabled: boolean }) {
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [created, setCreated] = useState<{ id: string; token: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const fieldId = useId();
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/onboarding/invitations", { cache: "no-store", headers: { "X-Reading-Group": groupId } });
      const result = await response.json() as { invitations: Invitation[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Davetler yüklenemedi.");
      setInvitations(result.invitations);
      setCheckedAt(Date.now());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Davetler yüklenemedi."); }
    finally { setLoading(false); }
  }
  async function command(action: "invitations" | "revoke-invitation", body: Record<string, unknown>) {
    if (disabled || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/onboarding/${action}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Reading-Group": groupId }, body: JSON.stringify(body) });
      const result = await response.json() as { id?: string; token?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Davet işlemi tamamlanamadı.");
      if (result.id && result.token) { setCreated({ id: result.id, token: result.token }); setCopied(false); }
      else if (action === "revoke-invitation" && body.id === created?.id) { setCreated(null); setCopied(false); }
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Davet işlemi tamamlanamadı."); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void command("invitations", { days: Number(form.get("days")), maxUses: Number(form.get("maxUses")) });
  }
  async function copy() {
    if (!created || disabled || busy) return;
    setCopied(false); setError("");
    try { await navigator.clipboard.writeText(`${location.origin}/join#invite=${created.token}`); setCopied(true); }
    catch { setError("Bağlantı kopyalanamadı."); }
  }
  return <details className="group-invitations" onToggle={(event) => { if (event.currentTarget.open) void load(); }}>
    <summary><UserPlus size={19} aria-hidden="true" /><span>Davetleri yönet</span><ChevronDown size={18} className="invitation-disclosure" aria-hidden="true" /></summary>
    {error && <p role="alert">{error}</p>}
    <div className="invitation-workspace">
      <form className="invitation-form" onSubmit={create} aria-busy={busy}>
        <h3 className="invitation-heading">Yeni davet</h3>
        <fieldset disabled={disabled || busy}>
          <legend className="sr-only">Davet sınırları</legend>
          <label>Geçerlilik (gün)<Input name="days" type="number" min={1} max={30} step={1} defaultValue={7} required /></label>
          <label>Kişi sınırı<Input name="maxUses" type="number" min={1} max={100} step={1} defaultValue={10} required /></label>
        </fieldset>
        <Button type="submit" className="group-command group-command-primary" disabled={disabled || busy}><Plus size={18} aria-hidden="true" />{busy ? "İşleniyor" : "Davet oluştur"}</Button>
      </form>
      <div className="invitation-records" aria-busy={loading}>
        {created && <div className="invitation-result">
          <label htmlFor={fieldId}>Davet bağlantısı</label>
          <div className="invitation-link-row">
            <Input id={fieldId} readOnly autoComplete="off" spellCheck={false} value={`${location.origin}/join#invite=${created.token}`} onFocus={(event) => event.target.select()} />
            <Button variant="outline" type="button" className="group-icon-button" aria-label="Bağlantıyı kopyala" title={copied ? "Bağlantı kopyalandı" : "Bağlantıyı kopyala"} disabled={disabled || busy} onClick={() => void copy()}>{copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}</Button>
          </div>
          <p className="invitation-copy-status" role="status">{copied ? "Bağlantı kopyalandı." : "Davet bağlantısı hazır."}</p>
        </div>}
        <h3 className="invitation-heading">Davet kayıtları</h3>
        {loading && !invitations && <p className="invitation-empty" role="status">Davetler yükleniyor.</p>}
        {!loading && !invitations && error && <Button variant="outline" type="button" className="group-command" disabled={disabled || busy} onClick={() => void load()}>Tekrar dene</Button>}
        {invitations?.length === 0 && <p className="invitation-empty">Henüz davet yok.</p>}
        <ul className="invitation-list" aria-label="Davet kayıtları">{invitations?.map((invite) => {
          const state = invite.revokedAt ? "revoked" : invite.expiresAt <= checkedAt ? "expired" : invite.uses >= invite.maxUses ? "full" : "active";
          const label = { revoked: "İptal edildi", expired: "Süresi doldu", full: "Kontenjan doldu", active: "Aktif" }[state];
          return <li key={invite.id} data-invitation-id={invite.id}>
            <div className="invitation-usage"><strong>{invite.uses}<span> / {invite.maxUses}</span></strong><small>katılım</small></div>
            <div className="invitation-expiry"><small>Son geçerlilik</small><time dateTime={new Date(invite.expiresAt).toISOString()}>{new Date(invite.expiresAt).toLocaleDateString("tr-TR")}</time></div>
            <span className="invitation-state" data-state={state}>{label}</span>
            <Button type="button" variant="ghost" className="group-icon-button invitation-revoke" title="Daveti iptal et" aria-label="Daveti iptal et" disabled={disabled || busy || !!invite.revokedAt} onClick={() => void command("revoke-invitation", { id: invite.id })}><Trash2 size={18} aria-hidden="true" /></Button>
          </li>;
        })}</ul>
      </div>
    </div>
  </details>;
}
