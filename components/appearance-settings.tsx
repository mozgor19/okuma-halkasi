"use client";

import { useState } from "react";
import { Check, Colors } from "@/components/icons";
import { useAppearance, type AppearanceScheme } from "@/components/appearance-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const schemes: Array<{
  id: AppearanceScheme;
  name: string;
  description: string;
}> = [
  { id: "editorial", name: "Dergi", description: "Edebi, sıcak ve güçlü tipografik hiyerarşi." },
  { id: "catalogue", name: "Katalog", description: "Düzenli, kurumsal ve arşiv odaklı." },
  { id: "notebook", name: "Defter", description: "Canlı, kişisel ve not defteri karakterinde." },
  { id: "minimal", name: "Minimal", description: "Yalnızca işlev, çizgi ve okunabilirlik." },
];

export function AppearanceSettings() {
  const { scheme, setScheme } = useAppearance();
  const [pendingScheme, setPendingScheme] = useState<AppearanceScheme | null>(null);
  const pending = schemes.find((item) => item.id === pendingScheme);

  return (
    <section className="profile-section appearance-section">
      <div className="profile-section-heading appearance-heading">
        <span className="eyebrow">GÖRÜNÜM</span>
        <h2>Uygulama şeması</h2>
        <p>İçerik ve yetkiler değişmez; yalnızca uygulamanın görsel dili değişir.</p>
      </div>

      <div className="scheme-grid" aria-label="Tasarım şemaları">
        {schemes.map((item) => (
          <button
            type="button"
            className={`scheme-option scheme-${item.id} ${scheme === item.id ? "selected" : ""}`}
            aria-pressed={scheme === item.id}
            key={item.id}
            onClick={() => {
              if (scheme !== item.id) setPendingScheme(item.id);
            }}
          >
            <span className="scheme-preview" aria-hidden="true">
              <i /><i /><i /><i />
            </span>
            <span className="scheme-copy">
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </span>
            {scheme === item.id && <span className="scheme-selected"><Check size={16} /> Etkin</span>}
          </button>
        ))}
      </div>

      <AlertDialog open={pendingScheme !== null} onOpenChange={(open) => { if (!open) setPendingScheme(null); }}>
        <AlertDialogContent className="scheme-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogMedia><Colors size={30} /></AlertDialogMedia>
            <AlertDialogTitle>Şema değiştirilsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Uygulama {pending?.name ?? "seçilen"} şemasına geçirilecek. Bu tercih yalnızca bu tarayıcıda saklanır ve istediğin zaman değiştirilebilir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingScheme) setScheme(pendingScheme);
              setPendingScheme(null);
            }}>Şemayı uygula</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
