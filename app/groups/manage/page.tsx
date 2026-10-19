"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Plus, UserPlus } from "@/components/icons";
import { AccountStatus, Field, OnboardingFrame, onboardingRequest, useAccountStatus } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { finishGroupSelection, groupFetch, type GroupsResponse, type ReadingGroup } from "@/lib/group-client";

export default function ManageGroupsPage() {
  const [data, setData] = useState<GroupsResponse | null>(null);
  const account = useAccountStatus();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/groups", { signal: controller.signal, cache: "no-store" }).then(async (groups) => {
      if (!groups.ok) throw new Error("Okuma grupları yüklenemedi.");
      const result = await groups.json() as GroupsResponse;
      if (!controller.signal.aborted) setData(result);
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [account.revision]);

  async function open(group: ReadingGroup) {
    setBusy(true); setError("");
    try {
      const response = await groupFetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json", "X-Reading-Group": group.id }, body: JSON.stringify({ groupId: group.id }) });
      if (!response.ok) throw new Error("Grup açılamadı.");
      finishGroupSelection(group, "/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Grup açılamadı."); setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || account.loading || !account.profile?.verified) return;
    const name = new FormData(event.currentTarget).get("name");
    key.current ||= crypto.randomUUID();
    setBusy(true); setError("");
    try {
      const result = await onboardingRequest<{ group: ReadingGroup; error?: string }>("create-group", { name, requestKey: key.current });
      await open(result.group);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Grup kurulamadı."); setBusy(false); }
  }
  return <OnboardingFrame title="Okuma gruplarım" back="/groups">
    <AccountStatus status={account} disabled={busy} />
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Yükleniyor.</p>}
    {!account.loading && account.profile?.verified === false && <p className="onboarding-status"><a className="small-link" href="/account">Grup kurmak veya davetle katılmak için e-postanı doğrula.</a></p>}
    <Tabs defaultValue="groups"><TabsList className="onboarding-tabs" variant="line" aria-label="Grup işlemi">
      <TabsTrigger value="groups" disabled={busy}><BookOpen size={17} /> Gruplarım</TabsTrigger>
      <TabsTrigger value="create" disabled={busy}><Plus size={17} /> Grup kur</TabsTrigger>
    </TabsList>
    <TabsContent value="groups"><div className="profile-meeting-list" aria-label="Okuma grupları">
      {data?.groups.length === 0 && <p>Henüz bir okuma grubuna üye değilsin.</p>}
      {data?.groups.map((group) => <button key={group.id} type="button" className="w-full min-w-0" disabled={busy} onClick={() => void open(group)}><BookOpen size={20} /><span className="min-w-0 break-words"><strong>{group.name}</strong><small>{group.role === "super_admin" ? "Ana yönetici" : group.role === "admin" ? "Yönetici" : "Katılımcı"}</small></span><ArrowRight size={17} /></button>)}
    </div></TabsContent><TabsContent value="create"><form className="login-form onboarding-form" onSubmit={create}>
      <Field id="group-name" name="name" label="Okuma grubu adı" required minLength={2} maxLength={100} onChange={() => { key.current = ""; }} disabled={busy} />
      <Button type="submit" disabled={busy || account.loading || !account.profile?.verified}>{busy ? "Kuruluyor" : "Okuma grubu oluştur"}</Button>
    </form></TabsContent></Tabs>
    <a className="small-link onboarding-command" href="/join"><UserPlus size={18} /> Davetle gruba katıl</a>
    <a className="small-link onboarding-command" href="/account">Hesap ve verilerim</a>
  </OnboardingFrame>;
}
