"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Field, OnboardingFrame, onboardingRequest } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { finishGroupSelection, type ReadingGroup } from "@/lib/group-client";
import { TOKEN_PATTERN } from "@/lib/onboarding-policy";

export default function JoinGroupPage() {
  const [token, setToken] = useState("");
  const [account, setAccount] = useState<"loading" | "anonymous" | "unverified" | "verified">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const fromLink = new URLSearchParams(location.hash.slice(1)).get("invite") || "";
      if (TOKEN_PATTERN.test(fromLink)) {
        setToken(fromLink); history.replaceState(null, "", "/join");
        try { sessionStorage.setItem("okumaPendingInvite", fromLink); } catch { /* Pasting the code still works without browser storage. */ }
      } else { try { setToken(sessionStorage.getItem("okumaPendingInvite") || ""); } catch { /* No persisted invitation. */ } }
    });
    const controller = new AbortController();
    void fetch("/api/onboarding/account", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (response.status === 401) { setAccount("anonymous"); return; }
      if (!response.ok) throw new Error("Hesap bilgileri yüklenemedi.");
      setAccount((await response.json() as { verified: boolean }).verified ? "verified" : "unverified");
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => { controller.abort(); cancelAnimationFrame(frame); };
  }, []);
  function invitation(value: string) {
    const candidate = value.trim();
    if (TOKEN_PATTERN.test(candidate)) return candidate;
    try { const url = new URL(candidate); return url.origin === location.origin && url.pathname === "/join" ? new URLSearchParams(url.hash.slice(1)).get("invite") || "" : ""; } catch { return ""; }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const value = invitation(token);
    if (!TOKEN_PATTERN.test(value)) { setError("Geçerli bir davet kodu veya bağlantısı gir."); return; }
    setBusy(true); setError("");
    try {
      const result = await onboardingRequest<{ group: ReadingGroup; error?: string }>("join-group", { token: value });
      const response = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json", "X-Reading-Group": result.group.id }, body: JSON.stringify({ groupId: result.group.id }) });
      if (!response.ok) throw new Error("Katıldığın grup açılamadı. Gruplarım ekranından tekrar seç.");
      try { sessionStorage.removeItem("okumaPendingInvite"); } catch { /* Storage cleanup cannot turn a successful join into a failure. */ }
      finishGroupSelection(result.group, "/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gruba katılınamadı."); setBusy(false); }
  }
  return <OnboardingFrame title="Gruba katıl" back="/groups/manage">
    {error && <p role="alert">{error}</p>}
    {account === "loading" && !error && <p role="status">Yükleniyor.</p>}
    {account === "anonymous" && <nav className="onboarding-links"><a href="/login?intent=join">Giriş yap</a><a href="/register?intent=join">Hesap oluştur</a></nav>}
    {account === "unverified" && <p><a className="small-link" href="/account">Önce e-posta adresini doğrula.</a></p>}
    <form className="login-form onboarding-form" onSubmit={submit}>
      <Field id="invite-token" label="Davet kodu veya bağlantısı" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={2048} value={token} onChange={(event) => {
        setToken(event.target.value);
        try { const value = invitation(event.target.value); if (TOKEN_PATTERN.test(value)) sessionStorage.setItem("okumaPendingInvite", value); else sessionStorage.removeItem("okumaPendingInvite"); } catch { /* Storage is optional. */ }
      }} />
      <Button type="submit" disabled={busy || account !== "verified"}>{busy ? "Katılınıyor" : "Gruba katıl"}</Button>
    </form>
  </OnboardingFrame>;
}
