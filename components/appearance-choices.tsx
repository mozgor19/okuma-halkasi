"use client";

import { Check, Computer, Moon, Sun } from "@/components/icons";
import type { AppearanceScheme, ColorMode } from "@/components/appearance-provider";
import { appearanceSchemes } from "@/lib/appearance-schemes";

export function AppearanceChoices({ scheme, mode, disabled, onScheme, onMode }: {
  scheme: AppearanceScheme; mode: ColorMode; disabled: boolean;
  onScheme(value: AppearanceScheme): void; onMode(value: ColorMode): void;
}) {
  return <div className="welcome-appearance-choices">
    <fieldset disabled={disabled} className="welcome-schemes">
      <legend className="sr-only">Tercih edilen görünüm</legend>
      <div className="welcome-scheme-grid">
        {appearanceSchemes.map((item) => <label key={item.id} className={`welcome-scheme-choice scheme-${item.id}`}>
          <input type="radio" name="welcome-scheme" value={item.id} checked={scheme === item.id} onChange={() => onScheme(item.id)} />
          <span className="scheme-preview" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="welcome-scheme-name">{item.name}{scheme === item.id && <Check size={18} aria-hidden="true" />}</span>
        </label>)}
      </div>
    </fieldset>
    <fieldset disabled={disabled} className="welcome-modes">
      <legend>Renk modu</legend>
      <div className="welcome-mode-options">
        {([{ id: "light", name: "Açık", icon: Sun }, { id: "dark", name: "Koyu", icon: Moon }, { id: "system", name: "Sistem", icon: Computer }] as const).map((item) => {
          const Icon = item.icon;
          return <label key={item.id}><input type="radio" name="welcome-mode" value={item.id} checked={mode === item.id} onChange={() => onMode(item.id)} />
            <Icon size={18} aria-hidden="true" /><span>{item.name}</span></label>;
        })}
      </div>
    </fieldset>
  </div>;
}
