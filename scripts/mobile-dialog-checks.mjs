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
      await page.emulateMedia({ reducedMotion: width === 390 ? "no-preference" : "reduce" });
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
        if (width < 681) {
          assert.equal(await dialog.evaluate(element => document.activeElement === element), true,
            label + ": opening a long mobile form must focus the dialog, not summon the keyboard during its animation");
          const positioning = await dialog.evaluate(element => {
            const style = getComputedStyle(element);
            return { transform: style.transform, translate: style.translate, animation: style.animationName, transition: style.transitionDuration };
          });
          assert.deepEqual(positioning, { transform: "none", translate: "none", animation: "none", transition: "0s" },
            label + ": mobile form positioning must not depend on centering transforms or zoom animations");
        }
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
            assert.ok(bounds.y >= 36 && bounds.y + bounds.height <= 397, label + ": dialog must fit the visible keyboard viewport: " + JSON.stringify({ bounds, style: await dialog.evaluate(element => ({ top: getComputedStyle(element).top, height: getComputedStyle(element).maxHeight, viewport: document.documentElement.style.cssText, scrollY })) }));
            const focused = await input.boundingBox();
            assert.ok(focused.y >= 36 && focused.y + focused.height <= 397, label + ": focused typing field must stay above keyboard");
            await submit.scrollIntoViewIfNeeded(); rect = await submit.boundingBox();
            assert.ok(rect.y >= 36 && rect.y + rect.height <= 397, label + ": final action must remain reachable above keyboard");
            assert.equal(await input.inputValue(), draft);
            await capture(label + "-keyboard");
            // Safari may blur a field before reporting that the keyboard closed.
            await input.blur();
            await page.locator("html:not([data-keyboard-open])").waitFor();
            const blurred = await dialog.boundingBox();
            assert.ok(blurred.y >= 36 && blurred.y + blurred.height <= 397,
              label + ": blur must not jump the dialog behind a still-visible keyboard");
            for (const top of [120, 0, 36]) {
              await input.focus();
              await page.evaluate(top => {
                Object.defineProperty(visualViewport, "offsetTop", { configurable: true, value: top });
                visualViewport.dispatchEvent(new Event("scroll"));
              }, top);
              await page.waitForFunction(top => {
                const rect = document.querySelector(".create-dialog").getBoundingClientRect();
                return rect.top >= top && rect.bottom <= top + 361;
              }, top);
              assert.equal(await input.inputValue(), draft);
            }
            // Closing the keyboard need not blur the field; stale iOS offsets
            // must not leave the dialog below the restored viewport.
            await page.evaluate(() => {
              Object.defineProperty(visualViewport, "height", { configurable: true, value: 844 });
              visualViewport.dispatchEvent(new Event("resize"));
            });
            await page.waitForFunction(() => {
              const rect = document.querySelector(".create-dialog").getBoundingClientRect();
              return rect.top >= 0 && rect.bottom <= 844 && rect.top < 36;
            });
            const zoomBefore = await dialog.boundingBox();
            await page.evaluate(() => {
              Object.defineProperties(visualViewport, { height: { configurable: true, value: 422 }, scale: { configurable: true, value: 2 } });
              visualViewport.dispatchEvent(new Event("resize"));
            });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.deepEqual(await dialog.boundingBox(), zoomBefore, label + ": pinch zoom must not reflow the form");
          } finally {
            await page.evaluate(() => {
              delete visualViewport.height; delete visualViewport.offsetTop; delete visualViewport.scale;
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
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (previous?.scheme && previous?.mode) await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme: previous.scheme, mode: previous.mode } });
  }
}
