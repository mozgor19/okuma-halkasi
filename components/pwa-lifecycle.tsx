"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Download } from "@/components/icons";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { isNativeApp } from "@/lib/native-bridge";
import { useOnline } from "@/lib/network-client";
import { keyboardViewport } from "@/lib/web-experience-policy";

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const InstallContext = createContext<{ install: InstallEvent | null; clear(): void }>({ install: null, clear() {} });

export function PwaLifecycle({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const online = useOnline();
  useEffect(() => {
    if (!enabled || isNativeApp() || !window.isSecureContext || !("serviceWorker" in navigator)) return;
    // Updates wait for the next fully closed session; never reload an unsaved form.
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const changed = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
    };
    const found = () => {
      installing?.removeEventListener("statechange", changed);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", changed);
      changed();
    };
    const refresh = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) void registration?.update().catch(() => {});
    };
    void navigator.serviceWorker.register("/koru-sw.js", { scope: "/", updateViaCache: "none" }).then((value) => {
      if (disposed) return;
      registration = value;
      registration.addEventListener("updatefound", found);
      found();
    }).catch(() => {});
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      registration?.removeEventListener("updatefound", found);
      installing?.removeEventListener("statechange", changed);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || isNativeApp()) return;
    if (matchMedia("(display-mode: standalone)").matches) return;
    const ready = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const done = () => setInstall(null);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", ready); window.removeEventListener("appinstalled", done); };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || isNativeApp() || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const editing = !!document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,[contenteditable="true"]');
        const keyboard = keyboardViewport(root.clientHeight, viewport.height, viewport.offsetTop, viewport.scale, editing);
        root.toggleAttribute("data-keyboard-open", keyboard.open);
        root.style.setProperty("--visible-viewport-height", `${keyboard.height}px`);
        root.style.setProperty("--visible-viewport-top", `${keyboard.top}px`);
        if (keyboard.open) frame = requestAnimationFrame(() => {
          const field = document.activeElement;
          if (!(field instanceof HTMLElement)) return;
          const scroller = field.closest<HTMLElement>(".create-dialog>.dialog-scroll,.create-dialog>.create-form");
          if (!scroller) return;
          // Scroll only the form, never the locked page or the dialog itself.
          const area = scroller.getBoundingClientRect(), bounds = field.getBoundingClientRect();
          const top = Math.max(area.top, keyboard.top) + 12;
          const bottom = Math.min(area.bottom, keyboard.top + keyboard.height) - 12;
          if (bottom <= top) return;
          if (bounds.height > bottom - top || bounds.top < top) scroller.scrollTop += bounds.top - top;
          else if (bounds.bottom > bottom) scroller.scrollTop += bounds.bottom - bottom;
        });
      });
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      root.removeAttribute("data-keyboard-open");
      root.style.removeProperty("--visible-viewport-height");
      root.style.removeProperty("--visible-viewport-top");
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const guard = (event: Event) => {
      if (navigator.onLine === false) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener("submit", guard, true);
    return () => document.removeEventListener("submit", guard, true);
  }, [enabled]);
  return <InstallContext.Provider value={{ install, clear: () => setInstall(null) }}>
    {enabled && (!online || updateReady) && <div className="web-connection-status" role="status" aria-live="polite">
      {!online ? "Çevrimdışısın. Kayıtlar güncel olmayabilir; değişiklikler kaydedilmez." : "Güncelleme hazır. Tüm Koru pencereleri kapatıldıktan sonraki açılışta uygulanacak."}
    </div>}
    {children}
  </InstallContext.Provider>;
}

export function PwaInstallAction() {
  const { install, clear } = useContext(InstallContext);
  const [busy, setBusy] = useState(false);
  if (!install) return null;
  return <DropdownMenuItem disabled={busy} onSelect={() => {
    setBusy(true);
    void install.prompt().then(() => install.userChoice).catch(() => {}).finally(() => { setBusy(false); clear(); });
  }}><Download /> Koru’yu yükle</DropdownMenuItem>;
}
