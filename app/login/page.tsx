"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, LockKeyhole, UserRound } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupsPath, safeReturnPath } from "@/lib/group-client";
import { GroupName, useGroupName } from "@/components/group-branding";
import { useOnboardingConfig } from "@/components/onboarding";
import { TOKEN_PATTERN } from "@/lib/onboarding-policy";

export default function LoginPage() {
  const groupName = useGroupName();
  const onboarding = useOnboardingConfig();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { error?: string; next?: string; selfService?: boolean };
      if (!response.ok) throw new Error(result.error ?? "Giriş yapılamadı.");
      let pendingInvite = false;
      try { pendingInvite = TOKEN_PATTERN.test(sessionStorage.getItem("okumaPendingInvite") || ""); } catch { /* Storage is optional. */ }
      if (result.selfService && (pendingInvite || new URLSearchParams(window.location.search).get("intent") === "join")) { window.location.replace("/join"); return; }
      const next = safeReturnPath(new URLSearchParams(window.location.search).get("next"));
      window.location.replace(result.next === "/groups" ? groupsPath(next) : next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <span><BookOpen size={26} strokeWidth={1.7} /></span>
          <strong><GroupName accentElement="em" /></strong>
        </div>
        <div className="login-copy">
          <span className="eyebrow">ÜYE GİRİŞİ</span>
          <h1 id="login-title">{groupName}</h1>
        </div>
        <form onSubmit={submit} className="login-form">
          <div className="login-field">
            <label htmlFor="username">Kullanıcı adı</label>
            <div className="login-input">
              <span className="login-input-icon" aria-hidden="true"><UserRound size={20} /></span>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                required
                maxLength={40}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
          </div>
          <div className="login-field">
            <label htmlFor="password">Şifre</label>
            <div className="login-input">
              <span className="login-input-icon" aria-hidden="true"><LockKeyhole size={20} /></span>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={200}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>
          {error && <p role="alert">{error}</p>}
          <Button type="submit" disabled={busy || !username || !password}>
            {busy ? "Giriş yapılıyor" : "Giriş yap"}
          </Button>
        </form>
        {onboarding?.enabled && <nav className="onboarding-links" aria-label="Hesap işlemleri"><a href="/register">Hesap oluştur</a><a href="/forgot-password">Şifremi unuttum</a><a href="/support">Destek</a></nav>}
      </section>
    </main>
  );
}
