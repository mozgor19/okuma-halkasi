import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as policy from "../../lib/local-face-policy.ts";
const ts = createRequire(import.meta.url)("typescript");
function fixture() {
  const state = { faces: 1, confidence: .99, detects: 0, saved: [], disposed: 0, outputs: [], configs: [], refs: [] };
  const descriptor = { execute(_input, output) {
    state.outputs.push(output); assert.equal(output, "global_pooling/Mean");
    return { data: async () => new Float32Array(1024).fill(.1 * state.outputs.length), dispose: () => state.disposed++ };
  } };
  class Human {
    constructor(config) { state.configs.push(config); }
    result = { face: [] };
    tf = { loadGraphModel: async () => descriptor, zeros: () => ({ dispose: () => state.disposed++ }), tidy: fn => fn(), image: { resizeBilinear: () => ({ expandDims: () => ({ mul: () => ({ dispose: () => state.disposed++ }) }) }) } };
    match = { similarity: () => .9 };
    load = async () => {};
    init = async () => {};
    detect = async () => {
      state.detects++;
      this.result = { face: Array.from({ length: state.faces }, () => ({ box: [0, 0, 120, 120], boxScore: state.confidence, tensor: { dispose: () => state.disposed++ } })) };
      return this.result;
    };
  }
  class Canvas {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() { return { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 }), putImageData() {} }; }
  }
  const self = { location: { origin: "https://birkoru.com" }, fetch: async () => { throw Error("Unexpected network request"); } };
  const vault = { readLocalReferences: async () => state.refs, saveLocalReference: async (_scope, ref) => { state.saved.push(ref); state.refs = [ref]; }, clearLocalReferences: async () => { state.refs = []; } };
  const code = ts.transpileModule(readFileSync("lib/local-face.worker.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", "self", "OffscreenCanvas", "createImageBitmap", "ImageData", code)(name => name === "@vladmandic/human" ? { Human } : name.endsWith("local-face-policy") ? policy : name.endsWith("local-face-vault") ? vault : assert.fail(name), {}, self, Canvas,
    async () => ({ width: 200, height: 200, close() {} }), class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } });
  let id = 0;
  const run = (action, extra = {}) => new Promise(resolve => { self.postMessage = resolve; self.onmessage({ data: { id: ++id, action, scope: { groupId: "synthetic", ownerId: 1 }, ...extra } }); });
  const enroll = () => run("enroll", { memberId: 7, consent: policy.LOCAL_FACE_CONSENT, file: new Blob(["synthetic"], { type: "image/png" }) });
  return { state, run, enroll };
}
test("worker refuses missing consent before loading models or decoding an image", async () => {
  const f = fixture(), result = await f.run("enroll", { memberId: 7 });
  assert.equal(result.ok, false); assert.equal(f.state.configs.length, 0); assert.equal(f.state.saved.length, 0);
});
test("worker produces three fresh embedding-only variants, disposes face tensors and returns no biometric data", async () => {
  const f = fixture(), result = await f.enroll();
  assert.equal(result.ok, true); assert.equal(result.result.variants, 3); assert.deepEqual(result.result.members, [7]);
  assert.equal(f.state.configs[0].face.description.enabled, false); assert.equal(f.state.configs[0].skipAllowed, false);
  assert.equal(f.state.outputs.length, 4); assert.equal(f.state.disposed, 11);
  assert.equal(new Set(f.state.saved[0].embeddings.map(vector => vector[0])).size, 3);
  assert.equal("embeddings" in result.result, false);
  const matched = await f.run("match", { consent: policy.LOCAL_FACE_CONSENT, memberIds: [7], file: new Blob(["synthetic"], { type: "image/png" }) });
  assert.equal(matched.ok, true); assert.deepEqual(matched.result.candidates, [{ memberId: 7, score: .9 }]);
});
test("worker rejects low-quality or multiple reference faces without saving, while disposing temporary tensors", async () => {
  for (const change of [{ faces: 2 }, { confidence: .7 }]) {
    const f = fixture(); Object.assign(f.state, change);
    assert.equal((await f.enroll()).ok, false); assert.equal(f.state.saved.length, 0);
    assert.equal(f.state.disposed, 2 + 3 * f.state.faces);
  }
});
