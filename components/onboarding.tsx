"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check, LogOut } from "@/components/icons";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TOKEN_PATTERN } from "@/lib/onboarding-policy";
import { requireOnline } from "@/lib/network-client";

export type OnboardingConfig = { enabled: boolean; ready: boolean; local: boolean; restrictedTest?: boolean; brand: string; supportEmail: string | null; privacyUrl: string | null; termsUrl: string | null; siteKey: string | null };
export function useOnboardingConfig() {
  const [config, setConfig] = useState<OnboardingConfig | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/onboarding/config", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (response.ok) setConfig(await response.json() as OnboardingConfig);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  return config;
}

type OnboardingAccount = { username: string; name: string; email: string | null; verified: boolean };
export function useAccountStatus(enabled = true) {
  const [profile, setProfile] = useState<OnboardingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => {
    setLoading(true); setError(""); setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/onboarding/account", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          window.location.replace("/login?next=" + encodeURIComponent(window.location.pathname));
          throw new Error("Oturum sona erdi. Yeniden giriş yap.");
        }
        if (!response.ok) throw new Error("Hesap bilgileri yüklenemedi. Yeniden dene.");
        const account = await response.json() as OnboardingAccount;
        if (typeof account?.verified !== "boolean" || typeof account.username !== "string" || typeof account.name !== "string"
          || (account.email !== null && typeof account.email !== "string")) throw new Error("Hesap bilgileri yüklenemedi. Yeniden dene.");
        if (!controller.signal.aborted) { setProfile(account); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) { setProfile(null); setError(cause instanceof Error ? cause.message : "Hesap bilgileri yüklenemedi."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [enabled, revision]);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const resume = () => {
      if (document.visibilityState === "visible") { clearTimeout(timer); timer = setTimeout(refresh, 100); }
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [enabled, refresh]);
  return { profile, loading, error, revision, refresh };
}

export function AccountStatus({ status, disabled = false }: { status: ReturnType<typeof useAccountStatus>; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Çıkış yapılamadı. Yeniden dene.");
      window.location.replace("/login");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Çıkış yapılamadı."); setBusy(false); }
  }
  return <>
    <div className="onboarding-account" aria-busy={status.loading || busy}>
      <div>{status.profile ? <><strong>{status.profile.name}</strong><span>@{status.profile.username}</span></> : <span>{status.loading ? "Hesap bilgileri yükleniyor." : "Hesap bilgileri alınamadı."}</span>}</div>
      <Button type="button" variant="ghost" size="icon" aria-label="Hesap durumunu yenile" title="Hesap durumunu yenile" disabled={disabled || busy || status.loading} onClick={status.refresh}><Check size={18} /></Button>
      <Button type="button" variant="ghost" size="icon" aria-label="Çıkış yap" title="Çıkış yap" disabled={disabled || busy} onClick={() => void signOut()}><LogOut size={18} /></Button>
    </div>
    {(status.error || error) && <p role="alert">{status.error || error}</p>}
  </>;
}

export async function onboardingRequest<T extends { error?: string }>(action: string, body: object): Promise<T> {
  requireOnline();
  let response: Response;
  try { response = await fetch(`/api/onboarding/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new Error("Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene."); }
  const result = await response.json().catch(() => null) as T | null;
  if (!result || typeof result !== "object") throw new Error("Sunucuya şu anda ulaşılamıyor. Daha sonra tekrar dene.");
  if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
  return result;
}

export function OnboardingFrame({ title, children, back = "/login" }: { title: string; children: ReactNode; back?: string }) {
  const config = useOnboardingConfig();
  return <main className="login-page"><section className="login-panel onboarding-panel" aria-labelledby="onboarding-title">
    <div className="login-brand"><span><BrandMark /></span><strong className={config?.brand === "Koru" ? "koru-wordmark" : undefined}>{config?.brand || "Okuma Halkası"}</strong></div>
    <div className="login-copy"><h1 id="onboarding-title">{title}</h1></div>
    {config?.restrictedTest && <p className="onboarding-test-notice" role="note">Sınırlı deneme ortamı. Yalnız izin verilen test e-postaları kullanılabilir. Başkalarına ait kişisel veri veya yüz fotoğrafı yüklemeyin.</p>}
    {children}
    <nav className="onboarding-links" aria-label="Hesap bağlantıları"><a href={back}><ArrowLeft size={16} /> Geri</a><a href="/support">Destek</a>{config?.privacyUrl && <a href={config.privacyUrl}>Gizlilik</a>}{config?.termsUrl && <a href={config.termsUrl}>Koşullar</a>}</nav>
  </section></main>;
}

export function Field({ label, id, ...props }: React.ComponentProps<typeof Input> & { label: string; id: string }) {
  return <div className="login-field"><label htmlFor={id}>{label}</label><Input id={id} name={id} {...props} /></div>;
}

type TurnstileApi = { render(element: HTMLElement, options: object): string; remove(id: string): void };
export function SecurityChallenge({ siteKey, action, onToken }: { siteKey: string; action: string; onToken: (token: string) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => { callback.current = onToken; }, [onToken]);
  useEffect(() => {
    let disposed = false;
    let widget: string | undefined;
    const api = () => (window as Window & { turnstile?: TurnstileApi }).turnstile;
    function render() {
      if (disposed || !element.current || !api() || widget) return;
      widget = api()!.render(element.current, { sitekey: siteKey, action, size: "flexible", callback: (token: string) => callback.current(token), "expired-callback": () => callback.current(""), "error-callback": () => callback.current("") });
    }
    let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (!script) { script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.dataset.turnstile = ""; script.async = true; document.head.appendChild(script); }
    script.addEventListener("load", render);
    render();
    return () => { disposed = true; script?.removeEventListener("load", render); if (widget) api()?.remove(widget); };
  }, [siteKey, action]);
  return <div ref={element} className="onboarding-challenge" />;
}

type AccountFlow = "register" | "verify-email" | "forgot-password" | "reset-password" | "link-email";
export function AccountForm({ flow, children }: { flow: AccountFlow; children?: ReactNode }) {
  const config = useOnboardingConfig();
  const account = useAccountStatus(flow === "link-email");
  const [token, setToken] = useState("");
  const [challenge, setChallenge] = useState("");
  const [challengeKey, setChallengeKey] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const value = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      if (TOKEN_PATTERN.test(value)) { setToken(value); window.history.replaceState(null, "", window.location.pathname + window.location.search); }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const isRegistration = flow === "register";
  const isVerify = flow === "verify-email";
  const hasPassword = isRegistration || flow === "reset-password" || flow === "link-email";
  const needsChallenge = isRegistration || flow === "forgot-password";
  const titles = { register: "Hesap oluştur", "verify-email": "E-postanı doğrula", "forgot-password": "Şifremi unuttum", "reset-password": "Yeni şifre belirle", "link-email": "E-posta adresini doğrula" };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setError(""); setMessage("");
    if ((isRegistration || flow === "reset-password") && form.get("password") !== form.get("confirmPassword")) { setError("Şifreler eşleşmiyor."); return; }
    setBusy(true);
    try {
      const result = await onboardingRequest<{ message?: string; error?: string }>(flow, {
        name: form.get("name"), email: form.get("email"), username: form.get("username"), password: form.get("password"),
        acceptedPolicy: form.get("acceptedPolicy") === "on", token, challenge,
      });
      setMessage(result.message || (isVerify ? "E-posta adresin doğrulandı. Giriş yapabilirsin." : "Şifren yenilendi. Yeniden giriş yap."));
      setComplete(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "İşlem tamamlanamadı."); }
    finally { setBusy(false); setChallenge(""); setChallengeKey((value) => value + 1); }
  }

  return <OnboardingFrame title={flow === "link-email" && children ? "Hesabım" : titles[flow]} back={flow === "link-email" ? "/groups/manage" : "/login"}>
    {flow === "link-email" && <AccountStatus status={account} disabled={busy} />}
    {!config && <p role="status">Yükleniyor.</p>}
    {config && !config.ready && <p role="alert">Kayıt ve e-posta hizmeti henüz kullanıma açılmadı.</p>}
    {message && <p className="onboarding-status" role="status">{message}</p>}
    {flow === "link-email" && account.profile?.verified ? <><p className="onboarding-status">E-posta adresin doğrulanmış.</p><a className="small-link" href="/groups/manage">Gruplarıma dön</a></> : complete ? <a className="small-link" href={flow === "link-email" ? "/groups/manage" : "/login"}>Devam et</a> : <form className="login-form onboarding-form" onSubmit={submit} aria-busy={busy}>
      {isRegistration && <><Field id="name" label="Ad soyad" autoComplete="name" required maxLength={80} /><Field id="username" label="Kullanıcı adı" autoComplete="username" autoCapitalize="none" pattern="[a-z0-9][a-z0-9._-]{2,39}" required minLength={3} maxLength={40} /></>}
      {(isRegistration || flow === "forgot-password" || flow === "link-email") && <Field id="email" label="E-posta" type="email" autoComplete="email" autoCapitalize="none" required maxLength={254} />}
      {hasPassword && <Field id="password" label={flow === "link-email" ? "Mevcut şifre" : "Yeni şifre"} type="password" autoComplete={flow === "link-email" ? "current-password" : "new-password"} required minLength={flow === "link-email" ? 1 : 12} maxLength={200} />}
      {(isRegistration || flow === "reset-password") && <Field id="confirmPassword" label="Şifre tekrarı" type="password" autoComplete="new-password" required minLength={12} maxLength={200} />}
      {isRegistration && <label className="onboarding-consent"><input type="checkbox" name="acceptedPolicy" required /><span>{config?.termsUrl ? <a href={config.termsUrl} target="_blank" rel="noreferrer">Kullanım koşullarını</a> : "Kullanım koşullarını"} kabul ediyorum; {config?.privacyUrl ? <a href={config.privacyUrl} target="_blank" rel="noreferrer">gizlilik bildirimini</a> : "gizlilik bildirimini"} okudum.</span></label>}
      {needsChallenge && config?.siteKey && <SecurityChallenge key={challengeKey} siteKey={config.siteKey} action={flow} onToken={setChallenge} />}
      {(isVerify || flow === "reset-password") && !token && <p role="alert">E-postadaki geçerli bağlantıyı aç.</p>}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !config?.ready || (flow === "link-email" && (account.loading || !account.profile)) || (needsChallenge && !config.local && !challenge) || ((isVerify || flow === "reset-password") && !token)}>{busy ? "İşleniyor" : isVerify ? "E-postamı doğrula" : flow === "forgot-password" ? "Yenileme bağlantısı gönder" : flow === "link-email" ? "Doğrulama bağlantısı gönder" : titles[flow]}</Button>
    </form>}
    {children}
  </OnboardingFrame>;
}
