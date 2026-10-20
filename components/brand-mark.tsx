"use client";

import { BookOpen } from "@/components/icons";
import { useKoruBrand } from "@/components/group-branding";
import { KORU_MARK_PATHS } from "@/lib/brand-identity";

export function BrandMark({ koru, size = 26 }: { koru?: boolean; size?: number }) {
  const configured = useKoruBrand();
  return (koru ?? configured) ? <svg className="koru-mark" width={size} height={size} viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" focusable="false">
    {KORU_MARK_PATHS.map((path) => <path key={path} d={path} />)}
  </svg> : <BookOpen size={size} strokeWidth={1.7} />;
}
