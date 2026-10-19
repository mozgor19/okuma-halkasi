"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "@/components/icons";
import { BrandMark } from "@/components/brand-mark";
import { useOnboardingConfig } from "@/components/onboarding";
import { POLICY_VERSION } from "@/lib/onboarding-policy";

export function PolicyDocument({ title, children }: { title: string; children: ReactNode }) {
  const config = useOnboardingConfig();
  return <main className="policy-page"><article className="policy-document" aria-labelledby="policy-title">
    <header><div className="login-brand"><BrandMark /><strong className="koru-wordmark">{config?.brand || "Koru"}</strong></div>
      <h1 id="policy-title">{title}</h1><p className="policy-meta">Sürüm: {POLICY_VERSION} · Hizmeti sunan: Mustafa Özgör</p>
    </header>
    <aside className="onboarding-test-notice">Bu metin sınırlı deneme sürümü içindir. Genel kullanıma açılmadan önce hukuki değerlendirme, saklama ve silme süreçleri ile yurt dışına veri aktarımı koşulları tamamlanmalıdır.</aside>
    {children}
    <footer><p>İletişim: <a href="mailto:koru.destek@gmail.com">koru.destek@gmail.com</a></p>
      <nav className="onboarding-links" aria-label="Hukuki bağlantılar"><a href="/register"><ArrowLeft size={16} /> Hesap oluştur</a><a href="/privacy">Gizlilik</a><a href="/terms">Kullanım koşulları</a><a href="/support">Destek</a></nav>
    </footer>
  </article></main>;
}
