self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL("/", self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || "/", self.location.origin);
    if (candidate.origin === self.location.origin && !candidate.username && !candidate.password) target = candidate;
  } catch { /* Invalid destinations return to the application. */ }
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin && "focus" in client);
    return existing ? existing.navigate(target.href).then((client) => client?.focus()) : self.clients.openWindow(target.href);
  }));
});
