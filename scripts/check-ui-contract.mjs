import fs from "node:fs";

const css = fs.readFileSync("app/themes.css", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");
const profile = fs.readFileSync("components/profile-view.tsx", "utf8");
const manifest = fs.readFileSync("public/manifest.webmanifest", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const notifications = fs.readFileSync("components/notification-center.tsx", "utf8");
const failures = [];

function requireText(source, needle, label) {
  if (!source.includes(needle)) failures.push(label);
}

function requireRule(source, selector, declarations, label) {
  const selectorStart = source.indexOf(selector);
  const blockStart = selectorStart < 0 ? -1 : source.indexOf("{", selectorStart);
  const blockEnd = blockStart < 0 ? -1 : source.indexOf("}", blockStart);
  const block = blockStart < 0 || blockEnd < 0 ? "" : source.slice(blockStart + 1, blockEnd);
  if (declarations.some((declaration) => !block.includes(declaration))) failures.push(label);
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
  ".create-form :is(input,textarea,select)", ".admin-add>div>:is(select,input)",
  ".gallery-actions", ".roadmap-admin", ".roadmap-admin-actions",
  ".roadmap-item .plan-voting", ".meeting-main", ".meeting-side",
  ".dark .create-dialog .create-form label", ".dark .face-reference-person strong",
  ".dark .management-person strong", ".dark .create-dialog .lookup-row button",
  ".dark .continuation-band strong", ".dark .management-row button",
  ".dark .profile-password-form label",
];
for (const selector of componentSelectors) requireText(css, selector, `Tema sözleşmesi kapsamıyor: ${selector}`);

requireRule(css, ".vote-reset-button", ["min-height:36px", "padding:7px 12px"], "Oy sıfırlama düğmesinin güvenli iç boşluğu eksik");
requireRule(css, '.create-form input[type="file"]::file-selector-button', ["min-height:32px", "padding:4px 12px"], "Dosya seçme düğmesinin güvenli iç boşluğu eksik");
requireRule(css, ".admin-add>div", ["border:1px solid var(--control-border)", "border-radius:var(--app-radius)", "overflow:hidden"], "Katılımcı ve misafir alanlarının kesintisiz dış çerçevesi eksik");
requireRule(css, ".admin-add>div:focus-within", ["outline:2px solid var(--color-focus)", "outline-offset:-2px"], "Birleşik alanların ortak odak çerçevesi eksik");
requireRule(css, ".admin-add>div>:is(select,input)", ["border:0!important", "border-radius:0!important"], "Birleşik alanın iç kontrolü çift çerçeve üretiyor");
requireRule(css, ".admin-add>div>button", ["border:0!important", "border-left:1px solid var(--control-border)!important"], "Birleşik alan düğmesinin iç ayırıcısı eksik");
requireRule(css, ".dark .admin-add>div>button:disabled", ["border:0!important", "border-left:1px solid var(--color-border)!important"], "Koyu modda devre dışı birleşik alan çerçevesi bozuluyor");
requireRule(css, 'html[data-scheme="notebook"] .side-nav button:after', ["background:var(--notebook-nav-track)"], "Defter navigasyonu Design Lab sekme şeridini kullanmıyor");
requireRule(css, ".login-input input", ["border:0!important", "background:transparent!important", "outline:0!important"], "Giriş alanı iç içe ikinci bir kutu üretiyor");
requireRule(css, ".login-input:before", ["left:41px", "width:1px", "background:var(--control-border)"], "Giriş alanı ikon ayırıcısı bağımsız değil");
requireRule(css, ".login-input>svg", ["top:50%", "left:12px", "width:18px", "height:18px", "transform:translateY(-50%)"], "Giriş alanı ikonu hücresinde ortalanmıyor");
requireRule(css, ".login-input input:is(:-webkit-autofill,:-webkit-autofill:hover,:-webkit-autofill:focus)", ["-webkit-text-fill-color:var(--control-text)!important", "-webkit-box-shadow:0 0 0 1000px var(--control-bg-active) inset!important", "transition:none!important"], "Tarayıcı otomatik doldurma rengi giriş alanını bölüyor");
requireRule(css, ".login-input:focus-within", ["outline:2px solid var(--color-focus)", "outline-offset:-2px"], "Giriş alanının ortak odak çerçevesi eksik");
requireText(css, "--notebook-nav-track:#dbe3e4", "Defter gündüz navigasyon şeridi referans renkten sapıyor");
requireText(css, "--notebook-nav-track:color-mix(in srgb,var(--color-text) 16%,var(--color-surface))", "Defter gece navigasyon şeridi tanımlı değil");
for (const icon of ["notebook-icon-192.png", "notebook-icon-512.png", "notebook-icon-maskable-512.png"]) {
  requireText(manifest, icon, "PWA manifestinde yeni Defter ikonu eksik: " + icon);
}
const iconContracts = [
  ["public/icons/notebook-apple-touch-icon.png", 180],
  ["public/icons/notebook-icon-192.png", 192],
  ["public/icons/notebook-icon-512.png", 512],
  ["public/icons/notebook-icon-maskable-512.png", 512],
];
for (const [path, size] of iconContracts) {
  if (!fs.existsSync(path)) {
    failures.push("Üretilmiş PWA ikonu eksik: " + path);
    continue;
  }
  const png = fs.readFileSync(path);
  if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) failures.push("PWA ikonu yanlış ölçüde: " + path);
}
requireText(layout, "/icons/notebook-apple-touch-icon.png", "Apple Touch ikonu yeni Defter görselini kullanmıyor");
requireText(notifications, "/icons/notebook-icon-192.png", "Bildirim ikonu yeni Defter görselini kullanmıyor");

const sourceContracts = [
  [page, 'const heroEyebrow = isAdminRole(member.role) ? "YENİ BULUŞMA" : featuredEyebrow;', "Ana sayfa yönetici hero etiketi oluşturma eylemiyle uyuşmuyor"],
  [page, '<span className="eyebrow light">{heroEyebrow}</span>', "Ana sayfa hero etiketi rol bazlı kaynağı kullanmıyor"],
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
