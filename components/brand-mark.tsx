"use client";

import { BookOpen } from "@/components/icons";
import { useKoruBrand } from "@/components/group-branding";

export function BrandMark({ koru, size = 26 }: { koru?: boolean; size?: number }) {
  const configured = useKoruBrand();
  return (koru ?? configured) ? <svg className="koru-mark" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <path d="M14 12v40M15 33l25-21M15 33l27 19" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
    <path d="M48 12v17M38 12v9M58 12v25" stroke="currentColor" strokeWidth="3" />
  </svg> : <BookOpen size={size} strokeWidth={1.7} />;
}
