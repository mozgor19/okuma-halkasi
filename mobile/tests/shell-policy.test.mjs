import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { base64ByteLength, deepLinkUrl, externalUrl, FILE_CHUNK_BYTES, isTrustedUrl, MAX_FILE_BYTES, resolveAppUrl, resultScript, validateBridgeRequest } from "../src/shell-policy.ts";
import { bootstrapScript, resumeScript } from "../src/web-bootstrap.ts";

const origin = "https://reading.example";
const file = { id: "file-1", type: "file", name: "2026-album.zip", mimeType: "application/zip", base64: "UEsFBg==" };
const validate = (request, source = origin + "/") => validateBridgeRequest(JSON.stringify(request), source, origin);

test("release requires an explicit HTTPS origin; development uses port 5174", () => {
  assert.equal(resolveAppUrl(undefined, true), "http://127.0.0.1:5174");
  assert.equal(resolveAppUrl(origin + "/", false), origin);
  for (const value of [undefined, "http://reading.example", origin + "/page", origin + "?token=secret", "https://user:password@reading.example"]) {
    assert.throws(() => resolveAppUrl(value, false));
  }
});

test("origin checks reject lookalikes, credentials, ports and executable schemes", () => {
  assert.equal(isTrustedUrl(origin + "/login?next=%2F", origin), true);
  for (const url of ["https://reading.example.evil.test", "https://reading.example@evil.test", "https://reading.example:8443/", "javascript:alert(1)", "file:///tmp/file", "https://reading.example\\@evil.test"]) {
    assert.equal(isTrustedUrl(url, origin), false, url);
  }
  assert.equal(externalUrl("https://maps.google.com/?q=books"), "https://maps.google.com/?q=books");
  assert.equal(externalUrl("geo:0,0?q=books"), "geo:0,0?q=books");
  assert.equal(externalUrl("mailto:reader@example.com"), "mailto:reader@example.com");
  for (const url of ["intent://bad", "javascript:alert(1)", "data:text/html,bad", "file:///tmp/file"]) assert.equal(externalUrl(url), null);
});

test("deep links retain group and meeting while rejecting redirect and auth routes", () => {
  assert.equal(deepLinkUrl("okumahalkasi://meeting/12?group=second", origin), origin + "/?group=second&meeting=12");
  assert.equal(deepLinkUrl("okumahalkasi://group/second?meeting=12", origin), origin + "/?meeting=12&group=second");
  assert.equal(deepLinkUrl(origin + "/?group=second&meeting=12", origin), origin + "/?group=second&meeting=12");
  for (const url of ["okumahalkasi://login?next=https://evil.test", "okumahalkasi://?meeting=0", "okumahalkasi://?meeting=1&meeting=2", "okumahalkasi://?group=../evil", "okumahalkasi://?next=/admin", "https://evil.test/?meeting=1"]) assert.equal(deepLinkUrl(url, origin), null, url);
});

test("bridge accepts only known requests from the configured origin", () => {
  assert.equal(validate(file).ok, true);
  assert.equal(validate(file, "https://evil.test").ok, false);
  assert.equal(validate({ ...file, session: "secret" }).ok, false);
  assert.equal(validate({ ...file, type: "execute" }).ok, false);
  assert.equal(validate({ id: "share-1", type: "share", title: "Book", text: "Meeting", url: origin + "/?meeting=12&group=second" }).ok, true);
  assert.equal(validate({ id: "share-1", type: "share", title: "Book", text: "Meeting", url: "https://evil.test" }).ok, false);
});

test("file export rejects path traversal, MIME mismatches and malformed base64", () => {
  for (const name of ["../album.zip", "sub/album.zip", "sub\\album.zip", ".hidden.zip", "album.exe", "album%2f.zip"]) assert.equal(validate({ ...file, name }).ok, false, name);
  assert.equal(validate({ ...file, name: "okuma-halkası.zip" }).ok, true);
  assert.equal(validate({ ...file, mimeType: "text/calendar" }).ok, false);
  for (const base64 of ["", "AAAA=", "AA=A", "A===", "!!!!", "AB==", "data:application/zip;base64,AAAA"]) assert.equal(validate({ ...file, base64 }).ok, false, base64);
});

test("20 MiB boundary measures decoded bytes including padding", () => {
  const maximum = Buffer.alloc(MAX_FILE_BYTES).toString("base64");
  assert.equal(base64ByteLength(maximum), MAX_FILE_BYTES);
  assert.equal(validate({ ...file, base64: maximum }).ok, true);
  const tooLarge = Buffer.alloc(MAX_FILE_BYTES + 1).toString("base64");
  assert.equal(base64ByteLength(tooLarge), null);
  const rejected = validate({ ...file, base64: tooLarge });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.id, file.id);
});

test("result delivery is escaped and restricted to the document origin", () => {
  const events = [];
  const context = { location: { origin }, window: { dispatchEvent: (event) => events.push(event) }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } };
  const result = { id: "request-1", ok: false, error: "</script>\u2028'\\" };
  vm.runInNewContext(resultScript(result, origin), context);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "okuma:native-result");
  assert.deepEqual(JSON.parse(JSON.stringify(events[0].detail)), result);
  context.location.origin = "https://evil.test";
  vm.runInNewContext(resultScript(result, origin), context);
  assert.equal(events.length, 1);
});

test("streaming exports support large files with bounded chunks and strict metadata", () => {
  const start = { id: "start-1", type: "file:start", transferId: "transfer-1", name: "album.zip", mimeType: "application/zip", size: 100 * 1024 * 1024 };
  assert.equal(validate(start).ok, true);
  for (const size of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(validate({ ...start, size }).ok, false);
  assert.equal(validate({ ...start, name: "../album.zip" }).ok, false);
  const chunk = { id: "chunk-1", type: "file:chunk", transferId: "transfer-1", offset: 0, base64: Buffer.alloc(FILE_CHUNK_BYTES).toString("base64") };
  assert.equal(validate(chunk).ok, true);
  assert.equal(validate({ ...chunk, offset: -1 }).ok, false);
  assert.equal(validate({ ...chunk, offset: 0.1 }).ok, false);
  assert.equal(validate({ ...chunk, base64: Buffer.alloc(FILE_CHUNK_BYTES + 1).toString("base64") }).ok, false);
  assert.equal(validate({ id: "end-1", type: "file:finish", transferId: "transfer-1" }).ok, true);
  assert.equal(validate({ id: "end-1", type: "file:finish", transferId: "transfer-1", session: "secret" }).ok, false);
  assert.equal(validate({ id: "cancel-1", type: "file:cancel", transferId: "transfer-1" }).ok, true);
});

test("notification bridge validates permission requests and same-origin meeting destinations", () => {
  assert.equal(validate({ id: "permission-1", type: "notifications:status" }).ok, true);
  assert.equal(validate({ id: "permission-1", type: "notifications:request", extra: true }).ok, false);
  const notification = { id: "notification-1", type: "notifications:show", key: "default-1-2026-10-16", title: "Meeting", body: "Synthetic notification", url: origin + "/?meeting=1&group=default" };
  assert.equal(validate(notification).ok, true);
  assert.equal(validate({ ...notification, url: "https://evil.test/?meeting=1" }).ok, false);
  assert.equal(validate({ ...notification, url: origin + "/api/auth/logout" }).ok, false);
  assert.equal(validate({ ...notification, key: "../notification" }).ok, false);
  assert.equal(validate({ ...notification, body: "x".repeat(4001) }).ok, false);
});

test("resume contract and bootstrap scripts parse without native dependencies", () => {
  new vm.Script(bootstrapScript(origin));
  const received = [];
  vm.runInNewContext(resumeScript(origin), {
    location: { origin }, window: { dispatchEvent: (event) => received.push(event.type) },
    CustomEvent: class { constructor(type) { this.type = type; } },
  });
  assert.deepEqual(received, ["okuma:resume"]);
});

test("bootstrap reinjection announces readiness without duplicating observers", () => {
  const received = [];
  let observers = 0;
  const window = { addEventListener() {}, dispatchEvent(event) { received.push(event.type); } };
  window.top = window;
  const context = vm.createContext({
    location: { origin }, window,
    document: { documentElement: {}, addEventListener() {} },
    requestAnimationFrame() {},
    MutationObserver: class { constructor() { observers++; } observe() {} },
    CustomEvent: class { constructor(type) { this.type = type; } },
  });
  vm.runInContext(bootstrapScript(origin), context);
  const shell = window.__okumaShell;
  vm.runInContext(bootstrapScript(origin), context);
  assert.deepEqual(received, ["okuma:native-ready", "okuma:native-ready"]);
  assert.equal(window.__okumaShell, shell);
  assert.equal(observers, 2);
});
