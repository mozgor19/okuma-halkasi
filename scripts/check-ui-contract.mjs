import fs from "node:fs";

const css = fs.readFileSync("app/themes.css", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");
const profile = fs.readFileSync("components/profile-view.tsx", "utf8");
const failures = [];

function requireText(source, needle, label) {
  if (!source.includes(needle)) failures.push(label);
}

function rgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(hex) {
  const channels = rgb(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a, b) {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

const semanticTokens = [
  "--color-canvas", "--color-surface", "--color-surface-subtle", "--color-text",
  "--color-text-muted", "--color-border", "--color-action", "--color-action-hover",
  "--color-on-action", "--color-focus", "--color-highlight", "--color-danger",
  "--control-bg", "--control-text", "--control-border", "--tab-text", "--tab-text-active",
];
for (const token of semanticTokens) requireText(css, token, `Eksik semantik token: ${token}`);

for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) {
  requireText(css, `html[data-scheme="${scheme}"]`, `Eksik gündüz şeması: ${scheme}`);
  requireText(css, `html.dark[data-scheme="${scheme}"]`, `Eksik koyu şema: ${scheme}`);
}

const componentSelectors = [
  ".face-reference-person strong", ".management-person strong", ".create-dialog",
  ".create-form :is(input,textarea,select)", ".admin-add :is(input,select)",
  ".gallery-actions", ".roadmap-admin", ".roadmap-admin-actions",
  ".roadmap-item .plan-voting", ".meeting-main", ".meeting-side",
  ".dark .create-dialog .create-form label", ".dark .face-reference-person strong",
  ".dark .management-person strong", ".dark .create-dialog .lookup-row button",
  ".dark .continuation-band strong", ".dark .management-row button",
  ".dark .profile-password-form label",
];
for (const selector of componentSelectors) requireText(css, selector, `Tema sözleşmesi kapsamıyor: ${selector}`);

const sourceContracts = [
  [page, 'className="roadmap-admin"', "Canlı yol haritasında yönetici araçları yok"],
  [page, 'className="roadmap-admin-actions"', "Yol haritası eylem grubu yok"],
  [page, 'className="create-dialog"', "Canlı formlar ortak modal sınıfını kullanmıyor"],
  [profile, 'className="face-reference-row"', "Yüz referansı ortak satır sınıfını kullanmıyor"],
  [profile, 'className="management-row"', "Yönetim ortak satır sınıfını kullanmıyor"],
];
for (const [source, needle, label] of sourceContracts) requireText(source, needle, label);

requireText(css, "@media(max-width:680px)", "680px mobil kırılımı eksik");
requireText(css, "calc(100vw - 24px)", "Modal güvenli mobil genişliği eksik");
requireText(css, ".dark{color-scheme:dark}", "Yerel form kontrolleri için koyu color-scheme eksik");
if (/\.dark[^{}]*\{[^{}]*(?:filter\s*:\s*invert|opacity\s*:\s*\.[0-8])/s.test(css)) {
  failures.push("Koyu modda invert veya soluk metin üreten opacity bulundu");
}

const contrastChecks = [
  ["gövde / zemin", "#e9e5de", "#15130f", 4.5],
  ["gövde / yüzey 1", "#e9e5de", "#211e18", 4.5],
  ["soluk metin / zemin", "#b8b0a5", "#15130f", 4.5],
  ["soluk metin / yüzey 1", "#b8b0a5", "#211e18", 4.5],
  ["gövde / yüzey 2", "#e9e5de", "#2d2922", 4.5],
  ["gövde / dergi vurgu yüzeyi", "#e9e5de", "#362f23", 4.5],
  ["gövde / katalog vurgu yüzeyi", "#e9e5de", "#2f3023", 4.5],
];
for (const [label, foreground, background, minimum] of contrastChecks) {
  const ratio = contrast(foreground, background);
  if (ratio < minimum) failures.push(`${label} kontrastı ${ratio.toFixed(2)}:1; en az ${minimum}:1 olmalı`);
}

if (failures.length) {
  console.error("UI sözleşmesi başarısız:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`UI sözleşmesi tamam: ${semanticTokens.length} token, 4 şema x 2 renk modu, ${componentSelectors.length} kritik bileşen ve ${contrastChecks.length} kontrast kontrolü.`);
