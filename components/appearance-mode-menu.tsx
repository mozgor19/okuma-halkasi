"use client";

import { Computer, Moon, Sun } from "@/components/icons";
import { useAppearance, type ColorMode } from "@/components/appearance-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const modes: Array<{
  id: ColorMode;
  name: string;
  icon: typeof Sun;
}> = [
  { id: "light", name: "Gündüz", icon: Sun },
  { id: "dark", name: "Gece", icon: Moon },
  { id: "system", name: "Sistem", icon: Computer },
];

export function AppearanceModeMenu() {
  const { mode, resolvedMode, setMode } = useAppearance();
  const selected = modes.find((item) => item.id === mode) ?? modes[2];
  const SelectedIcon = selected.icon;
  const resolvedLabel = resolvedMode === "dark" ? "gece" : "gündüz";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="topbar-tool appearance-mode-trigger"
          aria-label={`Renk modu: ${selected.name}`}
          title={`Renk modu: ${selected.name}`}
        >
          <SelectedIcon size={19} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="appearance-mode-menu">
        <DropdownMenuLabel>Renk modu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(value as ColorMode)}>
          {modes.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuRadioItem value={item.id} key={item.id}>
                <Icon size={18} />
                <span>{item.name}</span>
                {item.id === "system" && <small>{resolvedLabel}</small>}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
