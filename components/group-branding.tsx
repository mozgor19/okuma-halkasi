"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { LEGACY_APPLICATION_NAME, LEGACY_GROUP_NAME } from "@/lib/branding";
import { useReadingGroup } from "@/lib/group-client";

const BrandingContext = createContext({ name: LEGACY_GROUP_NAME, legacy: true, koru: false });

export function GroupBrandingProvider({ name: initialName, legacy, applicationName: productName, koru = false, children }: { name: string; legacy: boolean; applicationName?: string; koru?: boolean; children: ReactNode }) {
  const group = useReadingGroup();
  const name = group?.name ?? initialName;
  useEffect(() => {
    document.title = name;
    const applicationName = koru && productName ? productName : legacy ? LEGACY_APPLICATION_NAME : name;
    for (const key of ["application-name", "apple-mobile-web-app-title"]) {
      document.querySelector<HTMLMetaElement>(`meta[name="${key}"]`)?.setAttribute("content", applicationName);
    }
  }, [name, legacy, koru, productName]);
  return <BrandingContext.Provider value={{ name, legacy, koru }}>{children}</BrandingContext.Provider>;
}

export function useGroupName() { return useContext(BrandingContext).name; }
export function useKoruBrand() { return useContext(BrandingContext).koru; }

export function GroupName({ accentClassName, accentElement: Accent = "span" }: { accentClassName?: string; accentElement?: "span" | "em" | "b" }) {
  const { name, legacy, koru } = useContext(BrandingContext);
  return legacy ? <>Kitap Tahlil<Accent className={accentClassName}> &amp; İstişare</Accent></> : koru && name === "Koru" ? <span className="koru-wordmark">{name}</span> : <>{name}</>;
}
