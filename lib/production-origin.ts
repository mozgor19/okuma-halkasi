const canonical = "https://birkoru.com";
const aliases = new Set(["https://www.birkoru.com", "https://okuma-halkasi.mustafayapayzeka.workers.dev"]);

export function productionOriginRedirect(url: string, runtime: { AUTH_PROVIDER?: string; AUTH_PUBLIC_ORIGIN?: string }) {
  if (runtime.AUTH_PROVIDER !== "firebase" || runtime.AUTH_PUBLIC_ORIGIN !== canonical) return null;
  const source = new URL(url);
  const insecure = source.protocol === "http:" && !source.port && !source.username && !source.password
    && ["birkoru.com", "www.birkoru.com", "okuma-halkasi.mustafayapayzeka.workers.dev"].includes(source.hostname);
  if (!aliases.has(source.origin) && !insecure) return null;
  const target = new URL(canonical);
  target.pathname = source.pathname;
  target.search = source.search;
  return target.href;
}
