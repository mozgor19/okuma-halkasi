"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, LockKeyhole, UserRound } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
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
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Giriş yapılamadı.");
      window.location.replace("/");
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
          <strong>Kitap Tahlil <em>&amp; İstişare</em></strong>
        </div>
        <div className="login-copy">
          <span className="eyebrow">ÜYE GİRİŞİ</span>
          <h1 id="login-title">Kitap Tahlil &amp; İstişare</h1>
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
      </section>
    </main>
  );
}
