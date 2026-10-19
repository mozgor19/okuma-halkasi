"use client";
import { OnboardingFrame, useOnboardingConfig } from "@/components/onboarding";
export default function SupportPage() {
  const config = useOnboardingConfig();
  return <OnboardingFrame title="Destek"><p>Hizmeti sunan: Mustafa Özgör</p><p>Hesap erişimi, istenmeyen içerik ve kişisel veri taleplerinizi e-posta ile iletebilirsiniz. Grup adını ve sorunu belirtin; şifre veya doğrulama bağlantısı göndermeyin. Talepler elle değerlendirilir; anlık yanıt garantisi yoktur.</p>{!config ? <p role="status">Yükleniyor.</p> : config.supportEmail
    ? <a className="small-link" href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>
    : <p role="status">Destek adresi henüz yapılandırılmadı.</p>}</OnboardingFrame>;
}
