const canonical = "https://birkoru.com";
const aliases = new Set(["https://www.birkoru.com", "https://okuma-halkasi.mustafayapayzeka.workers.dev"]);

export function productionOriginRedirect(url: string, runtime: { AUTH_PROVIDER?: string; AUTH_PUBLIC_ORIGIN?: string }) {
  if (runtime.AUTH_PROVIDER !== "firebase" || runtime.AUTH_PUBLIC_ORIGIN !== canonical) return null;
  const source = new URL(url);
  if (!aliases.has(source.origin)) return null;
  const target = new URL(canonical);
  target.pathname = source.pathname;
  target.search = source.search;
  return target.href;
}
