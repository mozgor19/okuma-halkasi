import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { infoSite, renderInfoPages } from "../public-info/site.mjs";
import { KORU_BRAND } from "../lib/brand-identity.ts";

export const infoDirectory = resolve(".sites-runtime/koru-public-info");
export const infoAssets = join(infoDirectory, "assets");
export const infoConfig = join(infoDirectory, "wrangler.json");

export function assetDigest(directory = infoAssets) {
  const hash = createHash("sha256");
  function visit(path) {
    for (const name of readdirSync(path).sort()) {
      const full = join(path, name);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) throw new Error("Public assets cannot contain symbolic links");
      if (stat.isDirectory()) visit(full);
      else { hash.update(relative(directory, full) + "\0"); hash.update(readFileSync(full)); hash.update("\0"); }
    }
  }
  visit(directory);
  hash.update(readFileSync("public-info/worker.mjs"));
  return hash.digest("hex");
}

export function assertInfoConfig(config) {
  const allowed = ["name", "account_id", "main", "compatibility_date", "workers_dev", "preview_urls", "assets", "vars", "observability"];
  if (Object.keys(config).some((key) => !allowed.includes(key)) || config.name !== infoSite.worker || config.account_id !== infoSite.accountId
    || config.main !== resolve("public-info/worker.mjs") || config.workers_dev !== true || config.preview_urls !== false
    || config.compatibility_date !== "2026-05-15" || JSON.stringify(config.vars) !== JSON.stringify({ KORU_PUBLIC_INFO_ONLY: "true" })
    || JSON.stringify(config.observability) !== JSON.stringify({ enabled: false })
    || JSON.stringify(config.assets) !== JSON.stringify({ directory: infoAssets, binding: "ASSETS", run_worker_first: true, not_found_handling: "404-page" })) throw new Error("Public-info target/configuration mismatch; deployment refused");
}

export function buildInfoSite() {
  if (existsSync(infoDirectory) && lstatSync(infoDirectory).isSymbolicLink()) throw new Error("Public build directory cannot be a symbolic link");
  if (existsSync(infoAssets) && lstatSync(infoAssets).isSymbolicLink()) throw new Error("Public assets directory cannot be a symbolic link");
  // Recreate only this isolated generated directory; never package a stale file.
  rmSync(infoAssets, { recursive: true, force: true });
  mkdirSync(infoAssets, { recursive: true });
  function put(path, value) { const file = join(infoAssets, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, value); }
  const verificationFile = join(infoDirectory, "google-site-verification.json");
  const verification = existsSync(verificationFile) ? JSON.parse(readFileSync(verificationFile, "utf8")).content : null;
  for (const [path, html] of renderInfoPages(verification)) put(path === "/" ? "index.html" : path.slice(1) + ".html", html);
  for (const file of ["site.css", "theme.js"]) put(file, readFileSync("public-info/" + file));
  for (const file of [KORU_BRAND.icon, KORU_BRAND.appleIcon, KORU_BRAND.socialImage]) put(file.slice(1), readFileSync("public" + file));
  for (const file of ["fonts.css", "bricolage-latin.woff2", "bricolage-latin-ext.woff2", "literata-latin.woff2", "literata-latin-ext.woff2", "literata-italic-latin.woff2", "literata-italic-latin-ext.woff2", "bricolagegrotesque-OFL.txt", "literata-OFL.txt"]) put("fonts/" + file, readFileSync("public/fonts/" + file));
  for (const mode of ["light", "dark", "mobile-light", "mobile-dark"]) {
    const target = join(infoAssets, "images", `reading-example-${mode}.png`);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(`public-info/images/reading-example-${mode}.png`, target);
  }
  put("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${infoSite.origin}/sitemap.xml\n`);
  put("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ["/", "/privacy", "/terms"].map((path) => `<url><loc>${infoSite.origin + path}</loc></url>`).join("") + "</urlset>");
  const config = { name: infoSite.worker, account_id: infoSite.accountId, main: resolve("public-info/worker.mjs"), compatibility_date: "2026-05-15", workers_dev: true, preview_urls: false,
    assets: { directory: infoAssets, binding: "ASSETS", run_worker_first: true, not_found_handling: "404-page" }, vars: { KORU_PUBLIC_INFO_ONLY: "true" }, observability: { enabled: false } };
  assertInfoConfig(config);
  writeFileSync(infoConfig, JSON.stringify(config, null, 2));
  const report = { scope: "public-information-only", worker: infoSite.worker, origin: infoSite.origin, builtAt: new Date().toISOString(), assetDigest: assetDigest(), googleVerificationIncluded: !!verification };
  writeFileSync(join(infoDirectory, "build.json"), JSON.stringify(report, null, 2));
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) console.log(JSON.stringify(buildInfoSite(), null, 2));
