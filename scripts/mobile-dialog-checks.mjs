import assert from "node:assert/strict";

export async function checkMobileDialogs(page, context, origin, capture) {
  const layouts = [], headers = { Origin: origin, "X-Reading-Group": "default" };
  const cases = [
    { name: "meeting-edit", meeting: true, button: "Buluşmayı düzenle" },
    { name: "book-edit", meeting: true, button: "Kitap künyesini düzenle" },
    { name: "meeting-create", button: "Yeni buluşma oluştur" },
    { name: "plan-create", plan: true, button: "Kitap öner" },
  ];
  const appearance = await (await context.request.get(origin + "/api/groups")).json();
  const previous = appearance.groups.find(group => group.id === "default");
  const before = await (await context.request.get(origin + "/api/state", { headers })).json();
  try {
    for (const width of [320, 390, 430, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      assert.equal((await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme, mode } })).status(), 200);
      for (const scenario of cases) {
        await page.goto(origin + (scenario.meeting ? "/?meeting=1&group=default" : "/?group=default"));
        await page.waitForFunction(() => Object.keys(document.querySelector(".person-picker") || {}).some(key => key.startsWith("__reactProps")));
        if (scenario.plan) {
          const nav = await page.locator(".mobile-nav").isVisible() ? page.locator(".mobile-nav") : page.locator(".side-nav");
          await nav.getByRole("button", { name: /^(Plan|Gelecek kitaplar)$/ }).click();
        }
        await page.getByRole("button", { name: scenario.button, exact: true }).click();
        const dialog = page.locator(".create-dialog");
        await dialog.waitFor(); await page.evaluate(() => document.fonts.ready);
        const label = `${width}-${scheme}-${mode}-${scenario.name}`;
        const geometry = await dialog.evaluate(element => {
          const r = element.getBoundingClientRect();
          const fields = [...element.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]),textarea,select')].map(field => {
            const b = field.getBoundingClientRect();
            return { type: field.type, left: b.left, right: b.right, font: parseFloat(getComputedStyle(field).fontSize) };
          });
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, scroll: element.scrollWidth, client: element.clientWidth,
            documentWidth: document.documentElement.scrollWidth, fields };
        });
        if (width === 390 || width === 1440) await capture(label);
        assert.ok(geometry.left >= 0 && geometry.right <= width + 1, label + ": dialog must fit horizontally");
        assert.ok(geometry.top >= 0 && geometry.bottom <= (width === 1440 ? 1000 : 844) + 1, label + ": dialog must fit vertically");
        assert.ok(geometry.documentWidth <= width + 1 && geometry.scroll <= geometry.client + 1, label + ": no page or dialog overflow");
        assert.ok(geometry.fields.every(field => field.left >= geometry.left && field.right <= geometry.right), label + ": date/text/file/select must remain inside dialog");
        if (width < 681) assert.ok(geometry.fields.every(field => field.font >= 16), label + ": portal fields must not trigger iOS input auto-zoom");
        const submit = dialog.locator('button[type="submit"]');
        await submit.scrollIntoViewIfNeeded();
        let rect = await submit.boundingBox();
        assert.ok(rect.y >= 0 && rect.y + rect.height <= (width === 1440 ? 1000 : 844) + 1, label + ": final action must be reachable before keyboard");
        if (width === 390) {
          const input = dialog.locator('textarea,input[type="url"]').last();
          const draft = "Korunan taslak 123";
          await input.fill(draft);
          try {
            await page.evaluate(() => {
              Object.defineProperties(visualViewport, { height: { configurable: true, value: 360 }, offsetTop: { configurable: true, value: 36 } });
              visualViewport.dispatchEvent(new Event("resize"));
            });
            await page.locator("html[data-keyboard-open]").waitFor();
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const bounds = await dialog.boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, label + ": keyboard must not shift dialog left");
            assert.ok(bounds.y >= 36 && bounds.y + bounds.height <= 397, label + ": dialog must fit the visible keyboard viewport");
            const focused = await input.boundingBox();
            assert.ok(focused.y >= 36 && focused.y + focused.height <= 397, label + ": focused typing field must stay above keyboard");
            await submit.scrollIntoViewIfNeeded(); rect = await submit.boundingBox();
            assert.ok(rect.y >= 36 && rect.y + rect.height <= 397, label + ": final action must remain reachable above keyboard");
            assert.equal(await input.inputValue(), draft);
            await capture(label + "-keyboard");
          } finally {
            await page.evaluate(() => {
              delete visualViewport.height; delete visualViewport.offsetTop;
              document.activeElement?.blur(); visualViewport.dispatchEvent(new Event("resize"));
            });
          }
          await page.locator("html:not([data-keyboard-open])").waitFor();
          assert.equal(await input.inputValue(), draft);
        }
        layouts.push({ width, scheme, mode, dialog: scenario.name, keyboardSimulated: width === 390, fields: geometry.fields.length });
        await dialog.locator('[data-slot="dialog-close"]').click();
        await dialog.waitFor({ state: "hidden" });
        assert.equal(await page.locator('[data-slot="dialog-overlay"]').count(), 0);
      }
    }
    const after = await (await context.request.get(origin + "/api/state", { headers })).json();
    for (const table of ["books", "meetings", "roadmap"]) assert.deepEqual(after[table], before[table], "Cancelled form drafts must not change " + table);
    return layouts;
  } finally {
    if (previous?.scheme && previous?.mode) await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme: previous.scheme, mode: previous.mode } });
  }
}
