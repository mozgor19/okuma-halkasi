"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppearanceScheme = "editorial" | "catalogue" | "notebook" | "minimal";
export type ColorMode = "light" | "dark" | "system";
type ResolvedMode = "light" | "dark";

type AppearanceContextValue = {
  scheme: AppearanceScheme;
  mode: ColorMode;
  resolvedMode: ResolvedMode;
  setScheme: (scheme: AppearanceScheme) => void;
  setMode: (mode: ColorMode) => void;
};

const schemeKey = "kitapTahlilScheme";
const modeKey = "kitapTahlilColorMode";
const schemes: AppearanceScheme[] = ["editorial", "catalogue", "notebook", "minimal"];
const modes: ColorMode[] = ["light", "dark", "system"];

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function initialScheme(): AppearanceScheme {
  if (typeof document === "undefined") return "notebook";
  const value = document.documentElement.dataset.scheme;
  return schemes.includes(value as AppearanceScheme) ? value as AppearanceScheme : "notebook";
}

function initialMode(): ColorMode {
  if (typeof document === "undefined") return "system";
  const value = document.documentElement.dataset.mode;
  return modes.includes(value as ColorMode) ? value as ColorMode : "system";
}

function initialResolvedMode(): ResolvedMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.colorMode === "dark" ? "dark" : "light";
}

function systemMode(): ResolvedMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyAppearance(scheme: AppearanceScheme, mode: ColorMode, resolvedMode: ResolvedMode) {
  const root = document.documentElement;
  root.dataset.scheme = scheme;
  root.dataset.mode = mode;
  root.dataset.colorMode = resolvedMode;
  root.classList.toggle("dark", resolvedMode === "dark");
  root.style.colorScheme = resolvedMode;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<AppearanceScheme>(initialScheme);
  const [mode, setModeState] = useState<ColorMode>(initialMode);
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>(initialResolvedMode);

  useEffect(() => {
    applyAppearance(scheme, mode, resolvedMode);
  }, [mode, resolvedMode, scheme]);

  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolvedMode(systemMode());
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [mode]);

  const value = useMemo<AppearanceContextValue>(() => ({
    scheme,
    mode,
    resolvedMode,
    setScheme: (nextScheme) => {
      window.localStorage.setItem(schemeKey, nextScheme);
      setSchemeState(nextScheme);
    },
    setMode: (nextMode) => {
      window.localStorage.setItem(modeKey, nextMode);
      setModeState(nextMode);
      setResolvedMode(nextMode === "system" ? systemMode() : nextMode);
    },
  }), [mode, resolvedMode, scheme]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used inside AppearanceProvider");
  return context;
}
