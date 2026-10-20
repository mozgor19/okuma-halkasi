"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field, OnboardingFrame, onboardingRequest, useOnboardingConfig } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { validFirebaseActionCode } from "@/lib/firebase-auth-policy";

export default function FirebaseEmailPage() {
  const config = useOnboardingConfig();
  const [action, setAction] = useState<{ mode: "verifyEmail" | "resetPassword"; code: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const incoming = useRef<{ mode: "verifyEmail" | "resetPassword"; code: string } | null | undefined>(undefined);
  useEffect(() => {
    if (incoming.current === undefined) {
      const query = new URLSearchParams(window.location.search), mode = query.get("mode"), code = query.get("oobCode");
      incoming.current = (mode === "verifyEmail" || mode === "resetPassword") && validFirebaseActionCode(code) ? { mode, code } : null;
      // Email URLs are read once; do not retain their code in history, links or storage.
      window.history.replaceState(null, "", "/auth/email");
    }
    const frame = requestAnimationFrame(() => {
      if (incoming.current) setAction(incoming.current);
      else setError("E-postadaki geçerli doğrulama veya şifre yenileme bağlantısını aç.");
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!action || busy) return;
    const form = new FormData(event.currentTarget);
    if (action.mode === "resetPassword" && form.get("password") !== form.get("confirmPassword")) { setError("Şifreler eşleşmiyor."); return; }
    setBusy(true); setError("");
    try {
      const result = await onboardingRequest<{ message?: string; error?: string }>("firebase-action", { ...action, password: form.get("password") });
      setMessage(result.message || "İşlem tamamlandı. Giriş yapabilirsin."); setAction(null); incoming.current = null;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "İşlem tamamlanamadı."); }
    finally { setBusy(false); }
  }
  return <OnboardingFrame title={action?.mode === "resetPassword" ? "Yeni şifre belirle" : "E-postanı doğrula"}>
    {message ? <><p role="status" className="onboarding-status">{message}</p><a href="/login" className="small-link">Giriş yap</a></> : <form className="login-form onboarding-form" onSubmit={submit} aria-busy={busy}>
      {action?.mode === "resetPassword" && <><Field id="password" label="Yeni şifre" type="password" autoComplete="new-password" required minLength={12} maxLength={200} /><Field id="confirmPassword" label="Şifre tekrarı" type="password" autoComplete="new-password" required minLength={12} maxLength={200} /></>}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !action || !config?.ready || config.identityProvider !== "firebase"}>{busy ? "İşleniyor" : action?.mode === "resetPassword" ? "Şifremi yenile" : "E-postamı doğrula"}</Button>
    </form>}
  </OnboardingFrame>;
}
