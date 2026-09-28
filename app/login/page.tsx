"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
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
        body: JSON.stringify({ password }),
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
          <strong>okuma<em>halkası</em></strong>
        </div>
        <div className="login-copy">
          <span className="eyebrow">ÜYE GİRİŞİ</span>
          <h1 id="login-title">Okuma Halkası</h1>
        </div>
        <form onSubmit={submit} className="login-form">
          <label htmlFor="group-password">Grup şifresi</label>
          <div className="login-input">
            <LockKeyhole size={18} />
            <Input
              id="group-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              maxLength={200}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && <p role="alert">{error}</p>}
          <Button type="submit" disabled={busy || !password}>
            {busy ? "Giriş yapılıyor" : "Giriş yap"}
          </Button>
        </form>
      </section>
    </main>
  );
}
