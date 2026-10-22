"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Download, Plus, Share, X } from "@/components/icons";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { isNativeApp } from "@/lib/native-bridge";
import { useOnline } from "@/lib/network-client";

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const dismissalKey = "koru-install-dismissed-v1";
const dismissalPeriod = 7 * 24 * 60 * 60 * 1000;
const InstallContext = createContext({ available: false, busy: false, request() {} });

export function PwaInstallProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const online = useOnline();
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const standalone = matchMedia("(display-mode: standalone)");
    const narrow = matchMedia("(max-width: 680px)");
    const environment = () => {
      const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
      const runningInstalled = isNativeApp() || standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIos(apple && !runningInstalled);
      setInstalled(runningInstalled);
      setMobile(narrow.matches);
      if (runningInstalled) { setInstall(null); setGuide(false); }
    };
    const ready = (event: Event) => {
      if (isNativeApp() || standalone.matches || !("prompt" in event) || typeof event.prompt !== "function") return;
      event.preventDefault();
      setInstall(event as InstallEvent);
      setError("");
    };
    const done = () => { setInstalled(true); setInstall(null); setGuide(false); };
    const frame = requestAnimationFrame(() => {
      environment();
      try {
        const lastDismissed = Number(localStorage.getItem(dismissalKey));
        setDismissed(lastDismissed > 0 && Date.now() - lastDismissed < dismissalPeriod);
      } catch { setDismissed(false); }
    });
    standalone.addEventListener("change", environment);
    narrow.addEventListener("change", environment);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    window.addEventListener("okuma:native-ready", environment);
    return () => {
      cancelAnimationFrame(frame);
      standalone.removeEventListener("change", environment);
      narrow.removeEventListener("change", environment);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
      window.removeEventListener("okuma:native-ready", environment);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !mobile) return;
    const update = () => setBlocked(!!document.querySelector('[role="dialog"],[role="alertdialog"],[data-slot="dropdown-menu-content"]') || document.documentElement.hasAttribute("data-keyboard-open"));
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-keyboard-open"] });
    update();
    return () => observer.disconnect();
  }, [enabled, mobile]);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(dismissalKey, String(Date.now())); } catch { /* Dismissal still applies to this session. */ }
  }
  async function request() {
    if (pending.current || installed || isNativeApp() || !online) return;
    if (!install) { if (ios) setGuide(true); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      // Keep prompt() in the click's user-activation task; never auto-install.
      await install.prompt();
      const choice = await install.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      else dismiss();
    } catch { setError("Kurulum açılamadı. Tarayıcı menüsünden ana ekrana ekleyebilirsin."); }
    finally { setInstall(null); pending.current = false; setBusy(false); }
  }
  const available = enabled && !installed && (!!install || ios);
  const safePage = ["/", "/login", "/groups", "/groups/manage"].includes(pathname);
  const show = available && mobile && !dismissed && safePage && !blocked && online;
  return <InstallContext.Provider value={{ available, busy: busy || !online, request: () => void request() }}>
    {children}
    {show && <aside className="pwa-install-notice" aria-label="Koru’yu ana ekrana ekle">
      <BrandMark size={28} />
      <div><strong>Koru ana ekranında</strong><Button type="button" disabled={busy} onClick={() => void request()}><Download size={18} />Ana ekrana ekle</Button></div>
      <Button type="button" variant="ghost" size="icon" aria-label="Kurulum önerisini kapat" title="Kurulum önerisini kapat" onClick={dismiss}><X size={18} /></Button>
    </aside>}
    {error && <div className="pwa-install-error" role="alert"><span>{error}</span><Button type="button" variant="ghost" size="icon" aria-label="Kurulum uyarısını kapat" onClick={() => setError("")}><X size={18} /></Button></div>}
    <Dialog open={enabled && guide && !installed} onOpenChange={setGuide}>
      <DialogContent className="pwa-install-dialog">
        <DialogHeader><DialogTitle>Koru’yu ana ekrana ekle</DialogTitle><DialogDescription>Safari’de bu sayfayı aç, ardından:</DialogDescription></DialogHeader>
        <ol><li><Share size={20} /><span>Paylaş menüsünü aç.</span></li><li><Plus size={20} /><span>Ana Ekrana Ekle’yi seç.</span></li><li><Download size={20} /><span>Ekle’ye dokun.</span></li></ol>
        <Button type="button" onClick={() => { setGuide(false); dismiss(); }}>Tamam</Button>
      </DialogContent>
    </Dialog>
  </InstallContext.Provider>;
}

export function PwaInstallAction() {
  const { available, busy, request } = useContext(InstallContext);
  if (!available) return null;
  return <DropdownMenuItem disabled={busy} onSelect={request}><Download /> Koru’yu yükle</DropdownMenuItem>;
}
