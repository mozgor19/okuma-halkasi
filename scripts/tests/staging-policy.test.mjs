import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { applicationTables, assertBindings, assertDeployment, creationBindings, deploymentConfig, groups, schemaFor, seedFor, staging, stagingFailure } from "../staging-policy.mjs";

test("staging failures never copy browser request logs or sensitive values", () => {
  const privateMessage = "apiRequestContext.patch: read ECONNRESET\n cookie: session=private-cookie\n authorization: Bearer private-token\n https://example.test/#token=private-link";
  for (const error of [new Error(privateMessage), { name: "TimeoutError", message: privateMessage }, { code: "ERR_ASSERTION", message: privateMessage }, privateMessage, null]) {
    const message = stagingFailure(error);
    assert.match(message, /^Staging /);
    for (const value of ["private-cookie", "private-token", "private-link", "cookie:", "Bearer", "https:"]) assert.equal(message.includes(value), false);
  }
});

const built = {
  main: "index.js", assets: { directory: "../client" }, no_bundle: true,
  compatibility_date: "2026-05-15", compatibility_flags: ["nodejs_compat"],
  rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
  d1_databases: [{ binding: "DB", database_id: "production-must-not-be-copied" }],
  vars: { SESSION_SECRET: "never-copy-this", SELF_SERVICE_ENABLED: "true" },
  routes: ["production.invalid/*"], services: [{ binding: "PRODUCTION", service: "production" }],
};
const bindings = () => [
  ...staging.databases.map((db) => ({ name: db.binding, type: "d1", database_id: db.database_id })),
  { name: "TURNSTILE_SITE_KEY", type: "plain_text", text: "public-site-key" },
  { name: "TURNSTILE_SECRET_KEY", type: "secret_text" },
];

test("empty DB detection excludes only known reserved Cloudflare/SQLite tables", () => {
  assert.deepEqual(applicationTables(["_cf_KV", "_cf_METADATA", "sqlite_sequence"].map((name) => ({ name }))), []);
  assert.deepEqual(applicationTables(["_cf_custom", "members"].map((name) => ({ name }))), ["_cf_custom", "members"]);
});

test("staging builder never copies production bindings, secrets, routes or services", () => {
  const config = deploymentConfig(built, "public-site-key");
  assert.doesNotThrow(() => assertDeployment(config));
  const serialized = JSON.stringify(config);
  for (const value of ["production-must-not-be-copied", "never-copy-this", "production.invalid", "PRODUCTION"]) assert.equal(serialized.includes(value), false);
  assert.equal(config.vars.SELF_SERVICE_ENABLED, "false");
  assert.equal(config.vars.SELF_SERVICE_LOCAL, "false");
  assert.equal(config.vars.APPLICATION_BRAND, "Koru");
  assert.equal(new Set(config.d1_databases.map((db) => db.database_id)).size, 5);
});

test("restricted onboarding can only use empty creation pools, never existing fixture groups", () => {
  const config = deploymentConfig(built, "site", { onboarding: true });
  assert.doesNotThrow(() => assertDeployment(config));
  assert.equal(config.vars.SELF_SERVICE_ENABLED, "true");
  assert.deepEqual(JSON.parse(config.vars.SELF_SERVICE_GROUP_BINDINGS), creationBindings);
  assert.equal("SELF_SERVICE_TEST_EMAILS" in config.vars, false);
  config.vars.SELF_SERVICE_GROUP_BINDINGS = '["GROUP_POOL_ONE"]';
  assert.throws(() => assertDeployment(config));
});

test("initial pool binding transition permits only missing new pools, never other IDs", () => {
  const old = bindings().filter((db) => !creationBindings.includes(db.name));
  assert.throws(() => assertBindings(old));
  assert.doesNotThrow(() => assertBindings(old, { allowUnboundPool: true }));
  old[0].database_id = "production";
  assert.throws(() => assertBindings(old, { allowUnboundPool: true }));
});

for (const [name, mutate] of [
  ["worker", (c) => { c.name = "okuma-halkasi"; }],
  ["account", (c) => { c.account_id = "another-account"; }],
  ["database", (c) => { c.d1_databases[0].database_id = "production"; }],
  ["origin", (c) => { c.vars.AUTH_PUBLIC_ORIGIN = "https://production.invalid"; }],
  ["public signup", (c) => { c.vars.SELF_SERVICE_ENABLED = "true"; }],
  ["mail bypass", (c) => { c.vars.SELF_SERVICE_LOCAL = "true"; }],
  ["secret in vars", (c) => { c.vars.SESSION_SECRET = "secret"; }],
  ["resource", (c) => { c.services = [{ binding: "OTHER", service: "other" }]; }],
  ["route", (c) => { c.routes = ["production.invalid/*"]; }],
  ["artifact", (c) => { c.main = "/tmp/unverified.js"; }],
]) test(`deployment guard rejects modified ${name}`, () => {
  const config = structuredClone(deploymentConfig(built, "public-site-key"));
  mutate(config);
  assert.throws(() => assertDeployment(config));
});

test("remote bindings must match exact staging IDs and Turnstile types", () => {
  assert.equal(assertBindings(bindings()), "public-site-key");
  const wrongDb = bindings(); wrongDb[0].database_id = "production";
  assert.throws(() => assertBindings(wrongDb));
  const duplicate = bindings(); duplicate[1].database_id = duplicate[0].database_id;
  assert.throws(() => assertBindings(duplicate));
  const exposed = bindings(); exposed.at(-1).type = "plain_text";
  assert.throws(() => assertBindings(exposed));
  assert.throws(() => assertBindings(bindings().slice(0, -1)));
});

test("unrecognized build structure cannot be deployed", () => {
  assert.throws(() => deploymentConfig({ ...built, main: "other.js" }, "site"));
  assert.throws(() => schemaFor("PRODUCTION"));
  assert.throws(() => seedFor("PRODUCTION", []));
});

test("actual migrations and synthetic fixtures validate separately in all three schemas", () => {
  const accounts = [
    { username: "koru.coklu", name: "Test Coklu", hash: "synthetic-hash", salt: "synthetic-salt", iterations: 100_000 },
    { username: "koru.tek", name: "Test Tek", hash: "synthetic-hash", salt: "synthetic-salt", iterations: 100_000 },
  ];
  for (const { binding } of staging.databases) {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys=ON");
      const schema = schemaFor(binding);
      assert.match(schema.digest, /^[a-f0-9]{64}$/);
      db.exec(schema.sql);
      for (const statement of seedFor(binding, accounts)) db.prepare(statement.sql).run(...statement.params);
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
      if (binding === "DB") {
        assert.equal(db.prepare("SELECT count(*) AS n FROM member_accounts").get().n, 2);
        assert.equal(db.prepare("SELECT count(*) AS n FROM reading_group_memberships WHERE account_member_id=1").get().n, 2);
        assert.equal(db.prepare("SELECT count(*) AS n FROM reading_group_memberships WHERE account_member_id=2").get().n, 1);
        assert.equal(db.prepare("SELECT count(*) AS n FROM reading_group_memberships WHERE group_id='default'").get().n, 0);
        assert.equal(db.prepare("SELECT count(*) AS n FROM account_profiles").get().n, 0);
      } else if (creationBindings.includes(binding)) {
        for (const table of ["members", "books", "group_account_links", "group_database_ownership"]) assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
        assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='reading_groups'").get(), undefined);
      } else {
        assert.equal(db.prepare("SELECT count(*) AS n FROM member_accounts").get().n, 0);
        assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='reading_groups'").get(), undefined);
        const index = binding === "GROUP_POOL_ONE" ? 0 : 1;
        assert.equal(db.prepare("SELECT group_id FROM group_database_ownership").get().group_id, groups[index].id);
        assert.equal(db.prepare("SELECT member_id FROM group_account_links WHERE account_member_id=1").get().member_id, index === 0 ? 1 : 7);
      }
    } finally { db.close(); }
  }
});
