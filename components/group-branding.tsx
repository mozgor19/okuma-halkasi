"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { LEGACY_APPLICATION_NAME, LEGACY_GROUP_NAME } from "@/lib/branding";
import { useReadingGroup } from "@/lib/group-client";

const BrandingContext = createContext({ name: LEGACY_GROUP_NAME, legacy: true });

export function GroupBrandingProvider({ name: initialName, legacy, children }: { name: string; legacy: boolean; children: ReactNode }) {
  const group = useReadingGroup();
  const name = group?.name ?? initialName;
  useEffect(() => {
    document.title = name;
    const applicationName = legacy ? LEGACY_APPLICATION_NAME : name;
    for (const key of ["application-name", "apple-mobile-web-app-title"]) {
      document.querySelector<HTMLMetaElement>(`meta[name="${key}"]`)?.setAttribute("content", applicationName);
    }
  }, [name, legacy]);
  return <BrandingContext.Provider value={{ name, legacy }}>{children}</BrandingContext.Provider>;
}

export function useGroupName() { return useContext(BrandingContext).name; }

export function GroupName({ accentClassName, accentElement: Accent = "span" }: { accentClassName?: string; accentElement?: "span" | "em" | "b" }) {
  const { name, legacy } = useContext(BrandingContext);
  return legacy ? <>Kitap Tahlil<Accent className={accentClassName}> &amp; İstişare</Accent></> : <>{name}</>;
}
