import assert from "node:assert/strict";
import { test } from "node:test";
import { localTestSql } from "../local-d1-test.mjs";

const input = { config: "/tmp/test-wrangler.json", persistTo: "/tmp/test-state", command: "SELECT * FROM reading_group_memberships" };
const success = () => ({ status: 0, stdout: JSON.stringify([{ success: true, results: [{ count: 1 }] }]) });
const busy = () => ({ status: 1, stderr: "database is locked: SQLITE_BUSY" });
test("local SQL always uses explicit local config and retries bounded busy reads only", () => {
  let calls = 0;
  const waits = [];
  const result = localTestSql(input, (_node, args) => {
    assert.ok(args.includes("--local")); assert.ok(!args.includes("--remote"));
    assert.equal(args[args.indexOf("--config") + 1], input.config);
    return ++calls < 3 ? busy() : success();
  }, (ms) => waits.push(ms));
  assert.deepEqual(result, [{ count: 1 }]); assert.equal(calls, 3); assert.deepEqual(waits, [500, 1000]);
});
test("permanent locks and non-lock errors remain failures without private SQL output", () => {
  let calls = 0;
  assert.throws(() => localTestSql(input, () => { calls++; return busy(); }, () => {}), /failed/);
  assert.equal(calls, 3);
  calls = 0;
  assert.throws(() => localTestSql(input, () => { calls++; return { status: 1, stderr: "private-data SQL error" }; }), (error) => !error.message.includes("private-data"));
  assert.equal(calls, 1);
});
test("mutations, multi-statement reads, failed JSON results and subprocess errors never retry", () => {
  for (const command of ["INSERT INTO members VALUES(1)", "UPDATE members SET name='x'", "DELETE FROM members", "SELECT 1; DELETE FROM members", "WITH x AS (SELECT 1) SELECT * FROM x"]) {
    let calls = 0;
    assert.throws(() => localTestSql({ ...input, command }, () => { calls++; return busy(); }, () => assert.fail("Unexpected wait")));
    assert.equal(calls, 1);
  }
  assert.throws(() => localTestSql(input, () => ({ status: 0, stdout: JSON.stringify([{ success: false }]) })));
  assert.throws(() => localTestSql(input, () => ({ ...success(), error: new Error("subprocess denied") })));
});
