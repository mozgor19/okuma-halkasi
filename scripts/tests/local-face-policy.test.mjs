import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_FACE_CONSENT, LOCAL_FACE_TTL, localFaceScopeKey, localModelRequest, selectLocalMatches, validLocalEmbedding, validLocalReference } from "../../lib/local-face-policy.ts";
const vector = n => Array(1024).fill(n);
const reference = (id, values = [1]) => ({ memberId: id, embeddings: values.map(vector), createdAt: Date.now() - 1, consent: LOCAL_FACE_CONSENT });
test("local references bind model, group and signed-in member without collisions", () => {
  const a = localFaceScopeKey({ groupId: "group-1", ownerId: 1 });
  assert.notEqual(a, localFaceScopeKey({ groupId: "group-2", ownerId: 1 }));
  assert.notEqual(a, localFaceScopeKey({ groupId: "group-1", ownerId: 2 }));
  for (const scope of [{ groupId: "../x", ownerId: 1 }, { groupId: "x", ownerId: 0 }]) assert.throws(() => localFaceScopeKey(scope));
});
test("local vault input requires consent, finite1024 vectors and unexpired references", () => {
  assert.equal(validLocalEmbedding(vector(1)), true);
  for (const value of [[], vector(NaN), vector(Infinity), vector(101)]) assert.equal(validLocalEmbedding(value), false);
  assert.equal(validLocalReference(reference(1)), true);
  assert.equal(validLocalReference({ ...reference(1), consent: "old" }), false);
  assert.equal(validLocalReference({ ...reference(1), createdAt: Date.now() - LOCAL_FACE_TTL }), false);
  assert.equal(validLocalReference({ ...reference(1), createdAt: Date.now() + 10000 }), false);
  assert.equal(validLocalReference(reference(1, [1, 1, 1, 1])), false);
});
test("worker network fence accepts only six exact same-origin model assets", () => {
  for (const name of ["blazeface", "facemesh", "faceres"]) for (const ext of ["json", "bin"]) assert.equal(localModelRequest("/face-models/" + name + "." + ext, "https://birkoru.com").origin, "https://birkoru.com");
  for (const url of ["https://evil.test/face-models/faceres.bin", "/api/upload", "/face-models/faceres.bin?data=private", "/face-models/../upload", "/face-models/faceres.bin#x", "/face-models/unknown.bin"]) assert.throws(() => localModelRequest(url, "https://birkoru.com"));
});
test("conservative suggestions reject weak scores, close competitors and duplicate person claims", () => {
  assert.deepEqual(selectLocalMatches([vector(1)], [reference(1)], () => .66), []);
  assert.deepEqual(selectLocalMatches([vector(1)], [reference(1), reference(2)], (_a, b) => b[0] === 1 ? .8 : .79), []);
  assert.deepEqual(selectLocalMatches([vector(1), vector(2)], [reference(1)], () => .9), []);
  assert.deepEqual(selectLocalMatches([vector(1)], [reference(1)], () => .9), [{ memberId: 1, score: .9 }]);
});
test("one-reference lighting variants use weighted evidence, never multiple attendance votes", () => {
  const matches = selectLocalMatches([vector(1)], [reference(3, [.9, .8, .4])], (_a, b) => b[0]);
  assert.equal(matches.length, 1); assert.equal(matches[0].memberId, 3);
  assert.ok(Math.abs(matches[0].score - .875) < .00001);
});
