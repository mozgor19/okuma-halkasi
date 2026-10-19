import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { request } from "playwright";
import { groupsConfigPath, groupsSettingsPath, groupsStatePath, testOrigin, legacyOrigin } from "./test-environment.mjs";
import { localTestSql } from "./local-d1-test.mjs";

const config = groupsConfigPath;
const bindings = JSON.parse(readFileSync(config, "utf8")).d1_databases;
assert.equal(bindings.find((item) => item.binding === "DB")?.database_id, "11111111-1111-4111-8111-111111111111");
const { password } = JSON.parse(readFileSync(groupsSettingsPath, "utf8"));
function sql(command) {
  return localTestSql({ config, persistTo: groupsStatePath, command });
}
const main = await request.newContext({ baseURL: testOrigin });
const legacy = await request.newContext({ baseURL: legacyOrigin });
const member = await request.newContext({ baseURL: testOrigin });
let changed = false;
try {
  assert.equal(sql("SELECT * FROM reading_group_memberships WHERE account_member_id = 3").length, 0, "This test only uses the untouched demo.none fixture");
  assert.equal((await main.post("/api/auth/login", { data: { username: "demo.multi", password } })).status(), 200);
  assert.equal((await main.post("/api/groups", { headers: { Origin: testOrigin, "X-Reading-Group": "default" }, data: { groupId: "default" } })).status(), 200);
  const roster = async () => {
    const response = await main.get("/api/state", { headers: { "X-Reading-Group": "default" } });
    const state = await response.json();
    assert.equal(response.status(), 200, state.error);
    return state.members;
  };
  assert.ok(!(await roster()).some((person) => person.id === 3), "A global identity without default membership must not leak into the default roster");
  sql("INSERT INTO reading_group_memberships (account_member_id, group_id, member_id) VALUES (3, 'second', 3)");
  changed = true;
  const login = await member.post("/api/auth/login", { data: { username: "demo.none", password } });
  assert.equal(login.status(), 200);
  assert.equal((await login.json()).next, "/");
  assert.equal((await (await member.get("/api/state")).json()).readingGroup.id, "second");
  assert.equal((await legacy.post("/api/auth/login", { data: { username: "demo.none", password } })).status(), 403, "Disabling groups must not grant access to the default group");
  assert.ok(!(await roster()).some((person) => person.id === 3));
  sql("UPDATE reading_group_memberships SET is_active = 0 WHERE account_member_id = 3");
  assert.equal((await member.get("/api/state")).status(), 403, "Existing sessions lose access immediately when membership is deactivated");
  sql("INSERT INTO reading_group_memberships (account_member_id, group_id, member_id, is_active) VALUES (3, 'default', 3, 0)");
  assert.ok((await roster()).some((person) => person.id === 3), "Inactive membership preserves the historical member record");
  assert.equal((await legacy.post("/api/auth/login", { data: { username: "demo.none", password } })).status(), 403);
  console.log("Membership integration passed: identity-only roster privacy, second-only account, rollback denial, immediate revocation, historical member retention.");
} finally {
  if (changed) sql("DELETE FROM reading_group_memberships WHERE account_member_id = 3");
  await main.dispose();
  await legacy.dispose();
  await member.dispose();
}
