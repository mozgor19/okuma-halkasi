import assert from "node:assert/strict";

export async function checkGroupHero(page, context, origin, capture) {
  const initial = await (await context.request.get(origin + "/api/state")).json();
  assert.equal(initial.groupHeroUrl, null, "Use an isolated synthetic group without an existing custom image");
  const group = initial.readingGroup;
  assert.ok(group?.id);
  const headers = { Origin: origin, "X-Reading-Group": group.id };
  const layouts = [], owned = new Set();
  async function load(scheme, mode, width) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    assert.equal((await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme, mode } })).status(), 200);
    await page.goto(origin + "/?group=" + encodeURIComponent(group.id));
    await page.waitForFunction(() => Object.keys(document.querySelector(".person-picker") || {}).some(key => key.startsWith("__reactProps")));
    await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
    await page.evaluate(() => document.fonts.ready);
  }
  async function upload() {
    const chooserReady = page.waitForEvent("filechooser");
    await page.locator(".hero-image-tools label").click();
    const chooser = await chooserReady;
    const sent = page.waitForResponse(response => new URL(response.url()).pathname === "/api/upload" && response.request().method() === "POST");
    await chooser.setFiles("public/brand/koru-192-v2.png");
    const response = await sent;
    assert.equal(response.status(), 200);
    const { mediaKey } = await response.json(); owned.add(mediaKey);
    await page.getByRole("button", { name: "Varsayılan grup görseline dön", exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.hero-image-tools input[type="file"]')?.disabled);
    return mediaKey;
  }
  async function visibleImage(scheme, key) {
    if (scheme === "minimal") {
      const image = page.locator(".minimal-custom-hero img");
      if (key) {
        assert.equal(await image.isVisible(), true);
        await image.evaluate(element => element.decode());
        assert.ok((await image.getAttribute("src")).includes("/api/media/" + key));
      } else assert.equal(await image.count(), 0, "Minimal keeps its approved plain default header");
    } else {
      const background = await page.locator(".hero").evaluate(element => getComputedStyle(element).backgroundImage);
      assert.ok(background.includes(key ? "/api/media/" + key : "reading-room.webp"), `${scheme}: the VISIBLE background must use the selected image, not a hidden img element`);
      if (!key) assert.equal(background.includes("/api/media/"), false);
    }
    if (key) assert.ok(await page.evaluate(async path => {
      const image = new Image(); image.src = path; await image.decode();
      return image.naturalWidth > 0 && image.naturalHeight > 0;
    }, "/api/media/" + key + "?group=" + encodeURIComponent(group.id)));
  }
  async function cornerPixels() {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const box = await page.locator(".hero").boundingBox();
    return page.screenshot({ clip: { x: box.x + box.width - 66, y: box.y + box.height - 66, width: 48, height: 48 }, animations: "disabled" });
  }
  try {
    await load("notebook", "dark", 1440);
    await visibleImage("notebook", null);
    const before = await cornerPixels();
    const first = await upload();
    await visibleImage("notebook", first);
    assert.equal(before.equals(await cornerPixels()), false, "Actual picture pixels must change, not just the reset button");
    await capture("hero-notebook-dark-actual-upload");
    for (const width of [390, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
      await load(scheme, mode, width);
      await visibleImage(scheme, first);
      const control = await page.locator(".hero-image-tools label").boundingBox();
      assert.ok(control.width >= 44 && control.height >= 44);
      await capture(`hero-custom-${width}-${scheme}-${mode}`);
      layouts.push({ width, scheme, mode, custom: true });
    }
    // Select the same source file again through the real chooser, now on mobile.
    await load("notebook", "dark", 390);
    const second = await upload(); assert.notEqual(second, first);
    await visibleImage("notebook", second);
    assert.equal((await context.request.get(origin + "/api/media/" + first + "?group=" + encodeURIComponent(group.id))).status(), 404);
    await page.getByRole("button", { name: "Varsayılan grup görseline dön", exact: true }).click();
    await page.getByRole("button", { name: "Varsayılan grup görseline dön", exact: true }).waitFor({ state: "hidden" });
    assert.equal((await context.request.get(origin + "/api/media/" + second + "?group=" + encodeURIComponent(group.id))).status(), 404);
    for (const width of [390, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
      await load(scheme, mode, width);
      await visibleImage(scheme, null);
      await capture(`hero-default-${width}-${scheme}-${mode}`);
      layouts.push({ width, scheme, mode, custom: false });
    }
    return { layouts, actualPicturePixelsChanged: true, realFileChoosers: 2, sameFileReplacement: true };
  } finally {
    const state = await (await context.request.get(origin + "/api/state", { headers })).json();
    if (state.groupHeroUrl) {
      const key = new URL(state.groupHeroUrl, origin).pathname.split("/").pop();
      assert.ok(owned.has(key), "Another actor changed the group image; do not reset it");
      assert.equal((await context.request.post(origin + "/api/action", { headers, data: { action: "resetGroupHero" } })).status(), 200);
    }
    assert.equal((await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme: group.scheme, mode: group.mode } })).status(), 200);
  }
}
