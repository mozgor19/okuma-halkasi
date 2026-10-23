import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url), ts = require("typescript");
let config = null;
const compiled = { exports: {} };
const code = ts.transpileModule(readFileSync("components/policy-document.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
new Function("require", "module", "exports", code)(name => {
  if (name === "react/jsx-runtime") return require(name);
  if (name === "@/components/icons") return { ArrowLeft: () => null };
  if (name === "@/components/brand-mark") return { BrandMark: () => null };
  if (name === "@/components/onboarding") return { useOnboardingConfig: () => config };
  if (name === "@/lib/onboarding-policy") return { POLICY_VERSION: "synthetic-policy-version" };
  throw Error("Unexpected dependency: " + name);
}, compiled, compiled.exports);

const render = title => renderToStaticMarkup(createElement(compiled.exports.PolicyDocument, { title },
  createElement("section", null, "Saklama, silme ve veri aktarımı açıklamaları korunur.")));

test("public privacy and terms never claim to be restricted trials", () => {
  config = { brand: "Koru", restrictedTest: false };
  for (const title of ["Gizlilik ve kişisel veriler", "Kullanım koşulları"]) {
    const html = render(title);
    assert.doesNotMatch(html, /onboarding-test-notice|sınırlı deneme sürümü|Genel kullanıma açılmadan/);
    assert.ok(html.includes(title));
    assert.ok(html.includes("Saklama, silme ve veri aktarımı açıklamaları korunur."));
    for (const href of ["/privacy", "/terms", "/support", "mailto:koru.destek@gmail.com"]) assert.ok(html.includes(href));
  }
});
test("restricted staging retains the explicit trial warning", () => {
  config = { brand: "Koru", restrictedTest: true };
  assert.match(render("Gizlilik"), /onboarding-test-notice/);
  assert.match(render("Kullanım koşulları"), /Bu metin sınırlı deneme sürümü içindir/);
});
test("initial rendering or missing restriction flag cannot flash a trial notice", () => {
  for (const value of [null, { brand: "Koru" }]) {
    config = value;
    assert.doesNotMatch(render("Gizlilik"), /onboarding-test-notice|sınırlı deneme sürümü/);
  }
});
