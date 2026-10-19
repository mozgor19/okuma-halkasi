"use client";

import { AccountForm } from "@/components/onboarding";
import { AccountDataRequests, AccountExperienceProvider } from "@/components/account-experience";
import { useKoruBrand } from "@/components/group-branding";

export default function AccountPage() {
  const koru = useKoruBrand();
  return <AccountExperienceProvider enabled={koru}><AccountForm flow="link-email">{koru && <AccountDataRequests />}</AccountForm></AccountExperienceProvider>;
}
