import { readFileSync } from "node:fs";
import { firebaseAccountFixture } from "./firebase-account-test.mjs";

export function sharedGroupFixture() {
  const f = firebaseAccountFixture();
  f.sql.exec(readFileSync(new URL("../../drizzle/0015_shared_group_storage.sql", import.meta.url), "utf8"));
  f.env.SHARED_GROUPS_ENABLED = "true";
  f.env.READING_GROUP_DB_BINDINGS = "[]";
  f.env.SELF_SERVICE_GROUP_BINDINGS = "[]";
  for (let id = 1; id <= 5; id++) {
    f.legacy(id, "synthetic.reader" + id);
    f.sql.prepare("INSERT INTO account_profiles(member_id,email,verified_at,policy_version) VALUES(?,?,1,'fixture')").run(id, "reader" + id + "@example.test");
  }
  const create = (accountId, name = "Synthetic group", requestKey = crypto.randomUUID()) => f.load("db/onboarding-groups").createReadingGroup(accountId, { name, requestKey });
  async function request(accountId, groupId, path = "/api/state", method = "GET", body, extra = {}) {
    const token = await f.load("lib/auth").createSessionToken(accountId, 1);
    return new Request("https://birkoru.com" + path, { method, headers: {
      Cookie: "okuma_session=" + token + (groupId ? "; okuma_group=" + groupId : ""),
      Origin: "https://birkoru.com", "Content-Type": "application/json",
      ...(groupId ? { "X-Reading-Group": groupId } : {}), ...extra,
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async function action(accountId, groupId, payload) {
    const response = await f.load("app/api/action/route").POST(await request(accountId, groupId, "/api/action", "POST", payload));
    return { status: response.status, body: await response.json() };
  }
  async function state(accountId, groupId) {
    const response = await f.load("app/api/state/route").GET(await request(accountId, groupId));
    return { status: response.status, body: await response.json() };
  }
  function domain(groupId) { return new (f.load("db/domain-sql").DomainDatabase)(f.db, groupId); }
  return { ...f, create, request, action, state, domain };
}
