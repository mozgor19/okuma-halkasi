import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const env = {};
const compiledModule = { exports: {} };
const code = ts.transpileModule(readFileSync("lib/feature-policy.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("require", "module", "exports", code)((name) => {
  assert.equal(name, "cloudflare:workers"); return { env };
}, compiledModule, compiledModule.exports);

test("Koru server biometric storage remains off even when an old flag is enabled", () => {
  env.APPLICATION_BRAND = "Koru";
  for (const flag of [undefined, "false", "TRUE", "1", "invalid"]) {
    env.FACE_RECOGNITION_ENABLED = flag;
    assert.equal(compiledModule.exports.faceRecognitionEnabled(), false);
  }
  env.FACE_RECOGNITION_ENABLED = "true";
  assert.equal(compiledModule.exports.faceRecognitionEnabled(), false);
});
test("the historical web retains its behavior and can also disable biometric processing", () => {
  delete env.APPLICATION_BRAND; delete env.FACE_RECOGNITION_ENABLED;
  assert.equal(compiledModule.exports.faceRecognitionEnabled(), true);
  env.FACE_RECOGNITION_ENABLED = "false";
  assert.equal(compiledModule.exports.faceRecognitionEnabled(), false);
});
