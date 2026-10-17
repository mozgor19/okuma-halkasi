"use client";
import { OnboardingFrame, useOnboardingConfig } from "@/components/onboarding";
export default function SupportPage() {
  const config = useOnboardingConfig();
  return <OnboardingFrame title="Destek">{!config ? <p role="status">Yükleniyor.</p> : config.supportEmail
    ? <a className="small-link" href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>
    : <p role="status">Destek adresi henüz yapılandırılmadı.</p>}</OnboardingFrame>;
}
