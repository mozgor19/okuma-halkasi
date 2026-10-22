"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PwaInstallProvider } from "@/components/pwa-install";
import { isNativeApp } from "@/lib/native-bridge";
import { useOnline } from "@/lib/network-client";
import { keyboardViewport } from "@/lib/web-experience-policy";

export { PwaInstallAction } from "@/components/pwa-install";

export function PwaLifecycle({ enabled, children }: { enabled: boolean; children: ReactNode }) {
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
    if (!enabled || isNativeApp() || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const editing = !!document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,[contenteditable="true"]');
        const keyboard = keyboardViewport(root.clientHeight, viewport.height, viewport.offsetTop, viewport.scale, editing);
        const viewportTop = Math.min(keyboard.top, Math.max(0, root.clientHeight - keyboard.height));
        root.toggleAttribute("data-keyboard-open", keyboard.open);
        // Pinch zoom must magnify the form, not reflow it. Ignore stale Safari
        // offsets beyond the remaining layout viewport after keyboard dismissal.
        if (keyboard.height > 0 && Math.abs(viewport.scale - 1) < 0.05) {
          root.style.setProperty("--visible-viewport-height", `${keyboard.height}px`);
          root.style.setProperty("--visible-viewport-top", `${viewportTop}px`);
        }
        if (editing && Math.abs(viewport.scale - 1) < 0.05) frame = requestAnimationFrame(() => {
          const field = document.activeElement;
          if (!(field instanceof HTMLElement)) return;
          const scroller = field.closest<HTMLElement>(".create-dialog>.dialog-scroll,.create-dialog>.create-form");
          if (!scroller) return;
          // Scroll only the form, never the locked page or the dialog itself.
          const area = scroller.getBoundingClientRect(), bounds = field.getBoundingClientRect();
          const top = Math.max(area.top, viewportTop) + 12;
          const bottom = Math.min(area.bottom, viewportTop + keyboard.height) - 12;
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
  return <PwaInstallProvider enabled={enabled}>
    {enabled && (!online || updateReady) && <div className="web-connection-status" role="status" aria-live="polite">
      {!online ? "Çevrimdışısın. Kayıtlar güncel olmayabilir; değişiklikler kaydedilmez." : "Güncelleme hazır. Tüm Koru pencereleri kapatıldıktan sonraki açılışta uygulanacak."}
    </div>}
    {children}
  </PwaInstallProvider>;
}
