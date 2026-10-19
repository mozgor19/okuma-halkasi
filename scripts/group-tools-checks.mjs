import assert from "node:assert/strict";

export async function checkGroupTools(page) {
  const result = await page.locator(".reading-group-section").evaluate((section) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    function rgb(value) {
      context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    }
    function background(element) {
      for (let current = element; current; current = current.parentElement) {
        const value = rgb(getComputedStyle(current).backgroundColor);
        if (value[3] === 255) return value;
      }
      return [255, 255, 255, 255];
    }
    function luminance(value) {
      const linear = value.slice(0, 3).map((channel) => {
        const s = channel / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
      });
      return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    }
    function contrast(a, b) {
      const light = Math.max(luminance(a), luminance(b)), dark = Math.min(luminance(a), luminance(b));
      return (light + .05) / (dark + .05);
    }
    const bounds = section.getBoundingClientRect();
    const controls = [...section.querySelectorAll(".group-command,.group-icon-button,input,summary")].filter((el) => el.getClientRects().length);
    const enabled = controls.filter((el) => !el.matches(":disabled,[aria-disabled=true]"));
    const text = [...section.querySelectorAll("label,h3,small,time,.invitation-state,.invitation-copy-status")].filter((el) => el.getClientRects().length);
    const minimumTextContrast = Math.min(...[...enabled, ...text].map((el) => contrast(rgb(getComputedStyle(el).color), background(el))));
    const inputs = enabled.filter((el) => el.matches("input"));
    const minimumBorderContrast = Math.min(...inputs.map((el) => contrast(rgb(getComputedStyle(el).borderTopColor), background(el.parentElement))));
    const geometry = controls.every((el) => {
      const box = el.getBoundingClientRect();
      return box.height >= 43.5 && box.left >= bounds.left - 1 && box.right <= bounds.right + 1
        && (el.matches("input") || el.scrollWidth <= el.clientWidth + 1);
    });
    const headingsCompact = [...section.querySelectorAll(".invitation-heading")].every((el) => Number.parseFloat(getComputedStyle(el).fontSize) <= 18);
    const icons = [...section.querySelectorAll(".group-icon-button")].filter((el) => el.getClientRects().length);
    const iconControlsNamed = icons.every((el) => el.getAttribute("aria-label") && el.getAttribute("title"));
    return { minimumTextContrast, minimumBorderContrast, geometry, headingsCompact, iconControlsNamed, controlCount: controls.length, inputCount: inputs.length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  assert.equal(result.overflow, false, "Group tools must not create horizontal overflow");
  assert.equal(result.geometry, true, "Group controls must fit their section and have 44px targets");
  assert.equal(result.headingsCompact, true, "Group tool headings must retain compact typography");
  assert.equal(result.iconControlsNamed, true, "Icon commands need accessible names and tooltips");
  assert.ok(result.inputCount >= 2, "Open invitation controls must be included in the checks");
  assert.ok(result.minimumTextContrast >= 4.5, `Group text contrast: ${result.minimumTextContrast.toFixed(2)}`);
  assert.ok(result.minimumBorderContrast >= 3, `Group input contrast: ${result.minimumBorderContrast.toFixed(2)}`);
  return result;
}
