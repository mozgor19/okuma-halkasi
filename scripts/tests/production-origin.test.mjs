import assert from "node:assert/strict";
import test from "node:test";
import { productionOriginRedirect } from "../../lib/production-origin.ts";

test("only approved production aliases redirect, with paths and encoded query preserved", () => {
  const runtime = { AUTH_PROVIDER: "firebase", AUTH_PUBLIC_ORIGIN: "https://birkoru.com" };
  assert.equal(productionOriginRedirect("https://www.birkoru.com/join?next=%2Fgroups", runtime), "https://birkoru.com/join?next=%2Fgroups");
  assert.equal(productionOriginRedirect("https://okuma-halkasi.mustafayapayzeka.workers.dev/login", runtime), "https://birkoru.com/login");
  for (const url of ["https://birkoru.com/", "https://koru-staging.mustafayapayzeka.workers.dev/", "https://evil.test/"])
    assert.equal(productionOriginRedirect(url, runtime), null);
  assert.equal(productionOriginRedirect("https://www.birkoru.com/", {}), null);
  assert.equal(productionOriginRedirect("https://www.birkoru.com/", { ...runtime, AUTH_PROVIDER: "firebase-local" }), null);
});
