"use client";

import { useState } from "react";
import { Check, Colors, Computer, Moon, Sun } from "@/components/icons";
import { useAppearance, type AppearanceScheme, type ColorMode } from "@/components/appearance-provider";
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

const modes: Array<{
  id: ColorMode;
  name: string;
  icon: typeof Sun;
}> = [
  { id: "light", name: "Gündüz", icon: Sun },
  { id: "dark", name: "Gece", icon: Moon },
  { id: "system", name: "Sistem", icon: Computer },
];

export function AppearanceSettings() {
  const { scheme, mode, resolvedMode, setScheme, setMode } = useAppearance();
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

      <div className="mode-setting">
        <div>
          <strong>Renk modu</strong>
          <span>Sistem şu anda {resolvedMode === "dark" ? "gece" : "gündüz"} görünümünde.</span>
        </div>
        <div className="mode-control" role="radiogroup" aria-label="Renk modu">
          {modes.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={mode === item.id}
                className={mode === item.id ? "selected" : ""}
                key={item.id}
                onClick={() => setMode(item.id)}
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
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
