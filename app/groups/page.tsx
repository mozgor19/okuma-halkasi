"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, LogOut } from "@/components/icons";
import { AppearanceModeMenu } from "@/components/appearance-mode-menu";
import { GroupName } from "@/components/group-branding";
import { Button } from "@/components/ui/button";
import { currentReturnPath, finishGroupSelection, groupFetch, type GroupsResponse, type ReadingGroup } from "@/lib/group-client";
import { useOnboardingConfig } from "@/components/onboarding";

const roles = { member: "Katılımcı", admin: "Yönetici", super_admin: "Ana yönetici" };

export default function GroupsPage() {
  const onboarding = useOnboardingConfig();
  const [data, setData] = useState<GroupsResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const selecting = useRef(false);
  const [attempt, setAttempt] = useState(0);

  async function select(group: ReadingGroup, next = currentReturnPath()) {
    if (selecting.current) return;
    selecting.current = true;
    setBusy(group.id);
    setError("");
    try {
      const response = await groupFetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Reading-Group": group.id },
        body: JSON.stringify({ groupId: group.id }),
      });
      const result = await response.json() as { group?: ReadingGroup; error?: string };
      if (!response.ok || !result.group) throw new Error(result.error || "Okuma grubu seçilemedi.");
      finishGroupSelection(result.group, next);
    } catch (cause) {
      selecting.current = false;
      setBusy(null);
      setError(cause instanceof Error ? cause.message : "Okuma grubu seçilemedi.");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await groupFetch("/api/groups", { cache: "no-store", signal: controller.signal });
        const result = await response.json() as GroupsResponse & { error?: string };
        if (!response.ok) throw new Error(result.error || "Okuma grupları yüklenemedi.");
        if (controller.signal.aborted) return;
        if (!result.enabled) { window.location.replace(currentReturnPath()); return; }
        setData(result);
        const requested = new URL(currentReturnPath(), window.location.origin).searchParams.get("group");
        if (requested && !result.groups.some((group) => group.id === requested)) {
          setError("Bu bağlantının okuma grubuna erişimin yok. Başka bir grup seçebilirsin.");
        } else if (result.groups.length === 1) {
          await select(result.groups[0]);
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Okuma grupları yüklenemedi.");
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  async function signOut() {
    try {
      const response = await groupFetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Çıkış yapılamadı.");
      window.location.replace("/login");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Çıkış yapılamadı."); }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="groups-title" aria-busy={busy !== null}>
        <div className="login-brand">
          <span><BookOpen size={26} strokeWidth={1.7} /></span>
          <strong><GroupName /></strong>
        </div>
        <div className="login-copy">
          <span className="eyebrow">OKUMA GRUPLARIM</span>
          <h1 id="groups-title">Grubunu seç</h1>
        </div>
        {error && <p role="alert" style={{ color: "var(--color-danger)" }}>{error}</p>}
        {!data && !error && <p role="status">Okuma grupları yükleniyor.</p>}
        {!data && error && <Button variant="outline" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Tekrar dene</Button>}
        {data?.groups.length === 0 && <p>Henüz bir okuma grubuna üye değilsin.</p>}
        <div className="profile-meeting-list" aria-label="Okuma grupları">
          {data?.groups.map((group) => (
            <button type="button" className="w-full min-w-0" key={group.id} disabled={busy !== null} onClick={() => void select(group)}>
              <BookOpen size={20} />
              <span className="min-w-0 break-words"><strong>{group.name}</strong><small>{busy === group.id ? "Açılıyor" : roles[group.role]}</small></span>
              {group.id === data.selectedGroupId ? <Check size={18} aria-label="Seçili grup" /> : <ArrowRight size={18} />}
            </button>
          ))}
        </div>
        {onboarding?.enabled && <a className="small-link onboarding-command" href="/groups/manage">Grup kur veya katıl</a>}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className="small-link" disabled={busy !== null} onClick={() => void signOut()}><LogOut size={17} /> Çıkış yap</button>
          <AppearanceModeMenu />
        </div>
      </section>
    </main>
  );
}
