import assert from "node:assert/strict";
import test from "node:test";
import { developmentPassword } from "../groups-development.mjs";

test("synthetic fixture passwords always satisfy the real length, letter and digit policy without becoming predictable", () => {
  const values = Array.from({ length: 100 }, developmentPassword);
  assert.equal(new Set(values).size, values.length);
  for (const value of values) {
    assert.ok(value.length >= 12 && value.length <= 200);
    assert.match(value, /[A-Za-z]/); assert.match(value, /[0-9]/);
    assert.ok(value.startsWith("Local-Test-7-") && value.length >= 36);
  }
});
