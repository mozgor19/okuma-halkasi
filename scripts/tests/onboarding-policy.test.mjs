import assert from "node:assert/strict";
import test from "node:test";
import { bindingNames, cleanName, loopback, newToken, normalizeEmail, publicHttpsOrigin, TOKEN_PATTERN, tokenHash } from "../../lib/onboarding-policy.ts";

test("Email is normalized without provider-specific alias merging", () => {
  assert.equal(normalizeEmail(" Reader+books@Example.COM "), "reader+books@example.com");
  for (const value of [null, "", "a", "a@localhost", "a\r\nb@example.com", "a..b@example.com", ".a@example.com", "a.@example.com", "x@x..com", "x@y.com?x"]) assert.equal(normalizeEmail(value), null, String(value));
});
test("Group and account names reject control characters, markup and excessive size", () => {
  assert.equal(cleanName("  Kitap   dostları  "), "Kitap dostları");
  for (const value of [null, "a", "a".repeat(101), "<script>", "a\u0000b"]) assert.equal(cleanName(value), null);
});
test("Local mail cannot be enabled for a public host", () => {
  assert.equal(loopback(new URL("http://127.0.0.1:5184")), true);
  for (const value of ["https://example.com", "http://example.com", "https://localhost", "http://127.0.0.1.evil.com"]) assert.equal(loopback(new URL(value)), false);
});
test("Public identity origin cannot contain credentials or a local/placeholder host", () => {
  assert.equal(publicHttpsOrigin("https://books.example.com"), "https://books.example.com");
  for (const value of ["http://books.example.com", "https://localhost", "https://127.0.0.1", "https://10.1.2.3", "https://192.168.1.1", "https://app.local", "https://app.test", "https://[::1]", "https://user:secret@example.com", "https://example.com/path", "https://example.com?query", "https://example.com#fragment"]) assert.equal(publicHttpsOrigin(value), null);
});
test("Binding pool is explicit, unique and cannot allocate the canonical DB", () => {
  assert.deepEqual(bindingNames('["GROUP_A","GROUP_B"]'), ["GROUP_A", "GROUP_B"]);
  for (const value of ['["DB"]', '["group"]', '["GROUP_A","GROUP_A"]', '{}', '[null]', '["../../DB"]']) assert.throws(() => bindingNames(value));
});
test("Bearer secrets have 256 random bits and only their digest is an identifier", async () => {
  const token = newToken();
  assert.match(token, TOKEN_PATTERN);
  assert.notEqual(newToken(), token);
  assert.equal((await tokenHash(token)).length, 64);
  assert.notEqual(await tokenHash(token), token);
});
