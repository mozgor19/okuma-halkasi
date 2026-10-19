import assert from "node:assert/strict";
import test from "node:test";
import { keyboardViewport, TOUR_VERSION, validTourState } from "../../lib/web-experience-policy.ts";
import { cleanName } from "../../lib/onboarding-policy.ts";

test("only an editing focus with a substantially occluded viewport is a keyboard", () => {
  assert.equal(keyboardViewport(844, 500, 0, 1, true).open, true);
  assert.equal(keyboardViewport(844, 500, 24, 1, true).top, 24);
  for (const args of [[844, 844, 0, 1, true], [844, 760, 0, 1, true], [844, 500, 0, 2, true], [844, 500, 0, 1, false], [844, NaN, 0, 1, true], [844, 0, 0, 1, true], [844, 500, -1, 1, true]]) assert.equal(keyboardViewport(...args).open, false);
});
test("tour preferences are explicit, versioned and cannot imply unseen completion", () => {
  assert.equal(TOUR_VERSION, 1);
  assert.equal(validTourState("completed"), true);
  assert.equal(validTourState("dismissed"), true);
  for (const value of [null, false, "pending", "COMPLETED", {}, 1]) assert.equal(validTourState(value), false);
});
test("the existing server-side group name bound includes its exact boundary", () => {
  assert.equal(cleanName("İ".repeat(100)), "İ".repeat(100));
  assert.equal(cleanName("İ".repeat(101)), null);
  assert.equal(cleanName("Koru\u0000Grubu"), null);
});
