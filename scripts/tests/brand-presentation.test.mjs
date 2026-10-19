import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const env = {};
let enabled = true;
let selected = null;
const compiledModule = { exports: {} };
const source = ts.transpileModule(readFileSync(new URL("../../lib/group-presentation.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function("require", "module", "exports", source)((specifier) => {
  if (specifier === "cloudflare:workers") return { env };
  if (specifier === "@/lib/branding") return { APPLICATION_NAME: "Default application", LEGACY_GROUP_NAME: "Legacy group" };
  if (specifier === "@/lib/groups") return {
    readingGroupsEnabled: () => enabled,
    resolveReadingGroup: async () => { if (!selected) throw new Error("No current membership"); return { group: selected }; },
  };
  throw new Error("Unexpected module in presentation test");
}, compiledModule, compiledModule.exports);
const { groupPresentation } = compiledModule.exports;

test("environment branding is optional and does not change legacy/default branding", async () => {
  const request = new Request("https://staging.invalid/");
  assert.equal((await groupPresentation(request)).name, "Default application");
  env.APPLICATION_BRAND = " Koru ";
  assert.equal((await groupPresentation(request)).name, "Koru");
  enabled = false;
  assert.equal((await groupPresentation(request)).name, "Legacy group");
  enabled = true;
  env.APPLICATION_BRAND = "   ";
  assert.equal((await groupPresentation(request)).name, "Default application");
});

test("selected group name wins over product brand; anonymous visitors never see private group names", async () => {
  env.APPLICATION_BRAND = "Koru";
  selected = { id: "private", name: "Private reading circle", scheme: "notebook", mode: "light" };
  assert.equal((await groupPresentation(new Request("https://staging.invalid/"))).name, "Koru");
  const authenticated = new Request("https://staging.invalid/", { headers: { Cookie: "synthetic-session" } });
  assert.equal((await groupPresentation(authenticated)).name, selected.name);
  selected = null;
  assert.equal((await groupPresentation(authenticated)).name, "Koru");
});
