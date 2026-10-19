/* Koru public offline shell only. Never store accounts, group pages, API responses or media. */
const SHELL_CACHE = "koru-public-shell-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const response = await fetch(new Request(OFFLINE_URL, { cache: "reload", credentials: "omit" }));
    const finalUrl = new URL(response.url);
    if (!response.ok || finalUrl.origin !== self.location.origin || ![OFFLINE_URL, "/offline"].includes(finalUrl.pathname)
      || !response.headers.get("Content-Type")?.includes("text/html")) throw new Error("Public offline shell unavailable");
    // Cloudflare canonicalizes .html paths. A fresh response cannot replay that redirect offline.
    const shell = new Response(response.body, { status: 200, headers: response.headers });
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(OFFLINE_URL, shell);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith("koru-public-shell-") && key !== SHELL_CACHE)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== self.location.origin || url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(request).catch(async () => {
    const shell = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE });
    return shell || new Response("Internet bağlantısı gerekli.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL("/", self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || "/", self.location.origin);
    if (candidate.origin === self.location.origin && !candidate.username && !candidate.password && !candidate.pathname.startsWith("/api/")) target = candidate;
  } catch { /* Invalid notification destinations return to the application. */ }
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin && "focus" in client);
    return existing ? existing.navigate(target.href).then((client) => client?.focus()) : self.clients.openWindow(target.href);
  }));
});
