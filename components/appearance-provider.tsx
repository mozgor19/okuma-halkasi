"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { acceptReadingGroup, getReadingGroup, groupFetch, subscribeReadingGroup, type ReadingGroup } from "@/lib/group-client";
import { X } from "@/components/icons";

export type AppearanceScheme = "editorial" | "catalogue" | "notebook" | "minimal";
export type ColorMode = "light" | "dark" | "system";
type ResolvedMode = "light" | "dark";

type AppearanceContextValue = {
  scheme: AppearanceScheme;
  mode: ColorMode;
  resolvedMode: ResolvedMode;
  setScheme: (scheme: AppearanceScheme) => void;
  setMode: (mode: ColorMode) => void;
  saving: boolean;
  groupPreferences: boolean;
  applySavedAppearance(preference: { scheme: AppearanceScheme; mode: ColorMode }, group?: ReadingGroup): void;
};

const schemeKey = "kitapTahlilScheme";
const modeKey = "kitapTahlilColorMode";
const schemes: AppearanceScheme[] = ["editorial", "catalogue", "notebook", "minimal"];
const modes: ColorMode[] = ["light", "dark", "system"];

const AppearanceContext = createContext<AppearanceContextValue | null>(null);
const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

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
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);
  const [scheme, setSchemeState] = useState<AppearanceScheme>(initialScheme);
  const [mode, setModeState] = useState<ColorMode>(initialMode);
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>(initialResolvedMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [groupPreferences, setGroupPreferences] = useState(false);
  const savingRef = useRef(false);
  const committed = useRef({ scheme, mode });
  const applySavedAppearance = useCallback((next: { scheme: AppearanceScheme; mode: ColorMode }, group?: ReadingGroup) => {
    committed.current = next;
    setSchemeState(next.scheme);
    setModeState(next.mode);
    setResolvedMode(next.mode === "system" ? systemMode() : next.mode);
    if (group) acceptReadingGroup(group);
    else try {
      window.localStorage.setItem(schemeKey, next.scheme);
      window.localStorage.setItem(modeKey, next.mode);
    } catch { /* Server-owned defaults do not depend on optional browser storage. */ }
  }, []);

  useEffect(() => {
    const sync = () => {
      const group = getReadingGroup();
      setGroupPreferences(Boolean(group));
      if (!group || savingRef.current) return;
      const nextScheme = schemes.includes(group.scheme) ? group.scheme : "notebook";
      const nextMode = modes.includes(group.mode) ? group.mode : "system";
      committed.current = { scheme: nextScheme, mode: nextMode };
      setSchemeState(nextScheme);
      setModeState(nextMode);
      setResolvedMode(nextMode === "system" ? systemMode() : nextMode);
    };
    sync();
    return subscribeReadingGroup(sync);
  }, []);

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

  async function persist(change: { scheme?: AppearanceScheme; mode?: ColorMode }) {
    if (savingRef.current) return;
    const group = getReadingGroup();
    if (group === undefined && window.location.pathname === "/") {
      setError("Görünümü değiştirmeden önce kayıtların yüklenmesini bekle.");
      return;
    }
    const previous = committed.current;
    const next = { ...previous, ...change };
    setError("");
    setSchemeState(next.scheme);
    setModeState(next.mode);
    setResolvedMode(next.mode === "system" ? systemMode() : next.mode);
    if (group) {
      savingRef.current = true;
      setSaving(true);
      try {
        const response = await groupFetch("/api/groups/appearance", {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change),
        });
        const result = await response.json() as { group?: ReadingGroup; error?: string };
        if (!response.ok || !result.group) throw new Error(result.error || "Görünüm tercihi kaydedilemedi.");
        savingRef.current = false;
        acceptReadingGroup(result.group);
      } catch (cause) {
        setSchemeState(previous.scheme);
        setModeState(previous.mode);
        setResolvedMode(previous.mode === "system" ? systemMode() : previous.mode);
        setError(cause instanceof Error ? cause.message : "Görünüm tercihi kaydedilemedi.");
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
      return;
    }
    committed.current = next;
    try {
      window.localStorage.setItem(schemeKey, next.scheme);
      window.localStorage.setItem(modeKey, next.mode);
    } catch { /* Browser storage is optional; group preferences use the server. */ }
  }

  const value: AppearanceContextValue = {
    // The head script paints the saved palette; markup stays stable until hydration.
    scheme: hydrated ? scheme : "notebook",
    mode: hydrated ? mode : "system",
    resolvedMode: hydrated ? resolvedMode : "light",
    saving,
    groupPreferences,
    applySavedAppearance,
    setScheme: (nextScheme) => { void persist({ scheme: nextScheme }); },
    setMode: (nextMode) => { void persist({ mode: nextMode }); },
  };

  return <AppearanceContext.Provider value={value}>
    {error && <div className="error-banner" role="alert">{error}<button type="button" aria-label="Uyarıyı kapat" onClick={() => setError("")}><X size={16} /></button></div>}
    {children}
  </AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used inside AppearanceProvider");
  return context;
}
