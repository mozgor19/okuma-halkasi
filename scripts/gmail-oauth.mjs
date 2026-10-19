import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, closeSync, constants, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { OAuth2Client } from "google-auth-library";

export const gmailOAuth = Object.freeze({
  sender: "koru.destek@gmail.com",
  scope: "https://www.googleapis.com/auth/gmail.send",
  redirectUri: "http://127.0.0.1:53682/oauth/callback",
});
export const authorizationPath = resolve(".sites-runtime/koru-staging/gmail-authorization.json");
class SetupError extends Error {}

export function readOAuthClient(path) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = fstatSync(fd);
    if (!metadata.isFile() || metadata.size > 65_536) throw new Error();
    const value = JSON.parse(readFileSync(fd, "utf8"));
    const client = value?.web;
    if (!client || typeof client.client_id !== "string" || !/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(client.client_id)
      || typeof client.client_secret !== "string" || !client.client_secret.trim() || client.client_secret.length > 512 || /[\r\n]/.test(client.client_secret)
      || !Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(gmailOAuth.redirectUri)) throw new Error();
    // Downloaded endpoint fields are never used to route credentials.
    return { clientId: client.client_id, clientSecret: client.client_secret, redirectUri: gmailOAuth.redirectUri };
  } catch { throw new SetupError("OAuth JSON gecersiz. Web uygulamasi turunu ve yonlendirme adresini kontrol et; dosya icerigini paylasma."); }
  finally { if (fd !== undefined) closeSync(fd); }
}

export function findOAuthClient(input = join(homedir(), "Downloads")) {
  const path = resolve(input);
  if (!statSync(path).isDirectory()) return readOAuthClient(path);
  const clients = [];
  for (const name of readdirSync(path).filter((name) => name.toLowerCase().endsWith(".json"))) {
    try { clients.push(readOAuthClient(join(path, name))); } catch { /* Other downloads are not OAuth clients. */ }
  }
  if (clients.length !== 1) throw new SetupError("Klasorde tam bir uygun OAuth JSON bulunmali. Komuta JSON dosyasinin tam yolunu ekle; icerigini paylasma.");
  return clients[0];
}

export function validatedAuthorization(client, tokens, info, now = Date.now()) {
  if (typeof tokens?.refresh_token !== "string" || !tokens.refresh_token || typeof tokens.access_token !== "string" || !tokens.access_token) {
    throw new Error("Cevrimdisi gonderme yetkisi alinamadi. Yeniden izin vermen gerekiyor.");
  }
  if (info?.aud !== client.clientId || !Array.isArray(info.scopes) || info.scopes.length !== 1 || info.scopes[0] !== gmailOAuth.scope
    || !Number.isFinite(info.expiry_date) || info.expiry_date <= now
    || (info.email && info.email.toLowerCase() !== gmailOAuth.sender)) throw new Error("Google yetkisinin istemcisi, hesabi veya kapsami beklenenle eslesmiyor.");
  return {
    environment: "koru-staging", intendedSender: gmailOAuth.sender, scope: gmailOAuth.scope,
    clientId: client.clientId, clientSecret: client.clientSecret, refreshToken: tokens.refresh_token,
    authorizedAt: new Date(now).toISOString(),
    // gmail.send alone does not guarantee that Google returns account identity.
    senderVerified: info.email?.toLowerCase() === gmailOAuth.sender,
  };
}

export function saveAuthorization(value, path = authorizationPath) {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (realpathSync(directory) !== resolve(directory)) throw new Error("Yetki dizini sembolik bag olamaz.");
  chmodSync(directory, 0o700);
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2)); }
  catch { unlinkSync(path); throw new Error("Yetki guvenli bicimde kaydedilemedi."); }
  finally { closeSync(fd); }
}

function matches(value, expected) {
  if (typeof value !== "string") return false;
  const bytes = Buffer.from(value);
  const target = Buffer.from(expected);
  return bytes.length === target.length && timingSafeEqual(bytes, target);
}

export function createCallbackHandler({ state, browserToken, authorizationUrl, exchange, persist, complete }) {
  const redirect = new URL(gmailOAuth.redirectUri);
  let consumed = false;
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    const reply = (status, text) => { response.statusCode = status; response.end(text); };
    if (request.method !== "GET" || request.headers.host !== redirect.host || !request.url?.startsWith("/") || request.url.startsWith("//") || request.url.length > 8192) return reply(400, "Gecersiz istek.");
    const url = new URL(request.url, redirect.origin);
    if (url.pathname === `/authorize/${state}` && !url.search && !consumed) {
      response.setHeader("Set-Cookie", `koru_mail_oauth=${browserToken}; HttpOnly; SameSite=Lax; Path=/oauth/callback; Max-Age=600`);
      response.setHeader("Location", authorizationUrl);
      return reply(302, "Google yetkilendirmesine yonlendiriliyor.");
    }
    if (url.pathname !== redirect.pathname) return reply(404, "Sayfa bulunamadi.");
    const cookies = (request.headers.cookie || "").split(";").map((item) => item.trim());
    if (url.searchParams.getAll("state").length !== 1 || !matches(url.searchParams.get("state"), state)
      || !cookies.includes(`koru_mail_oauth=${browserToken}`)) return reply(403, "Yetkilendirme oturumu gecersiz. Terminaldeki adresi ayni tarayicida ac.");
    if (consumed) return reply(409, "Bu yetkilendirme zaten kullanildi.");
    if (url.searchParams.has("error")) {
      consumed = true;
      reply(400, "Google yetkilendirmesi iptal edildi. Terminale don.");
      return complete(new Error("Google yetkilendirmesi iptal edildi."));
    }
    const codes = url.searchParams.getAll("code");
    if (codes.length !== 1 || !codes[0] || codes[0].length > 4096) return reply(400, "Yetkilendirme kodu gecersiz.");
    consumed = true;
    response.setHeader("Set-Cookie", "koru_mail_oauth=; HttpOnly; SameSite=Lax; Path=/oauth/callback; Max-Age=0");
    try {
      await persist(await exchange(codes[0]));
      reply(200, "Yetkilendirme kaydedildi. Bu pencereyi kapatip terminale donebilirsin. E-posta gonderimi henuz acilmadi.");
      complete();
    } catch {
      reply(502, "Yetkilendirme tamamlanamadi. Terminale don; adresi veya gizli anahtarlari paylasma.");
      complete(new SetupError("Google yetkilendirmesi tamamlanamadi. Test kullanicisini, gonderme iznini ve internet baglantisini kontrol et; hassas ayrintilar gizlendi."));
    }
  };
}

export async function authorizeGmail(client, { signal, timeoutMs = 10 * 60_000, onReady = () => {}, destination = authorizationPath } = {}) {
  if (existsSync(destination)) throw new SetupError("Kayitli yetki zaten var. Uzerine yazilmadi; yenileme icin once mevcut yetkiyi incelemeliyiz.");
  const oauth = new OAuth2Client({ ...client, transporterOptions: { timeout: 15_000, retry: false } });
  const state = randomBytes(32).toString("base64url");
  const browserToken = randomBytes(32).toString("base64url");
  const { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync();
  const authorizationUrl = oauth.generateAuthUrl({
    scope: [gmailOAuth.scope], access_type: "offline", prompt: "consent", login_hint: gmailOAuth.sender,
    state, include_granted_scopes: false, code_challenge: codeChallenge, code_challenge_method: "S256",
  });
  let complete;
  let active = true;
  const done = new Promise((resolve, reject) => { complete = (error) => error ? reject(error) : resolve(); });
  const handler = createCallbackHandler({ state, browserToken, authorizationUrl, complete,
    persist(value) {
      if (!active || signal?.aborted) throw new Error("Yetkilendirme durduruldu.");
      saveAuthorization(value, destination);
    },
    async exchange(code) {
      const { tokens } = await oauth.getToken({ code, codeVerifier, redirect_uri: gmailOAuth.redirectUri });
      return validatedAuthorization(client, tokens, await oauth.getTokenInfo(tokens.access_token));
    },
  });
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 5000, headersTimeout: 5000 }, (request, response) => {
    handler(request, response).catch(() => { response.end(); complete(new Error("Yerel yetkilendirme istegi basarisiz.")); });
  });
  const timer = setTimeout(() => complete(new SetupError("Yetkilendirme suresi doldu. Komutu tekrar calistir.")), timeoutMs);
  const abort = () => complete(new SetupError("Yetkilendirme durduruldu."));
  signal?.addEventListener("abort", abort, { once: true });
  server.on("error", () => complete(new SetupError("53682 portu acilamadi. Bu portu kullanan diger yetkilendirme aracini kapat.")));
  try {
    if (signal?.aborted) abort();
    else server.listen(53682, "127.0.0.1", () => {
      try { onReady(`http://127.0.0.1:53682/authorize/${state}`); }
      catch { complete(new Error("Tarayici adimi baslatilamadi.")); }
    });
    await done;
  } finally {
    active = false;
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    await new Promise((resolve) => {
      const force = setTimeout(() => { server.closeAllConnections(); resolve(); }, 1000);
      force.unref();
      server.close(() => { clearTimeout(force); resolve(); });
      server.closeIdleConnections();
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.filter((arg) => arg !== "--check").length > 1 || args.some((arg) => arg.startsWith("--") && arg !== "--check")) throw new SetupError("Kullanim: staging:mail:authorize [JSON dosyasi veya klasoru] [--check]");
  const client = findOAuthClient(args.find((arg) => arg !== "--check"));
  if (args.includes("--check")) { console.log("OAuth JSON ve yerel donus adresi dogrulandi. Icerik gizlendi; baglanti kurulmadi."); return; }
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort); process.once("SIGTERM", abort);
  try {
    await authorizeGmail(client, { signal: controller.signal, onReady(url) {
      console.log("Bu adresi bu bilgisayardaki tarayicida ac. Adresi veya donus sayfasinin adresini paylasma:");
      console.log(url);
      console.log(`Yalniz ${gmailOAuth.sender} hesabini sec ve yalniz e-posta gonderme iznini onayla. Beklenmeyen bir uygulama veya ek izin gorursen dur.`);
    } });
    console.log("Yetkilendirme kaydedildi. Gizli dosya Git disinda ve 0600 izninde tutuluyor.");
    console.log("Bu komut Cloudflare'e yukleme, e-posta gonderimi veya canli site degisikligi yapmadi.");
    console.log("Google Testing durumunda yenileme yetkisi 7 gun sonra sona erer. Bu kurulum kalici canli posta kabulunu gecmez.");
  } finally { process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error instanceof SetupError ? error.message : "Yetkilendirme basarisiz. JSON dosyasi, donus adresi, test kullanicisi ve 53682 portunu kontrol et. Hassas ayrintilar gizlendi; anahtar veya token paylasma."); process.exitCode = 1; });
}
