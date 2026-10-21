import assert from "node:assert/strict";

export async function checkEmptyPanelContrast(page, view) {
  const result = await page.locator(".empty-panel").evaluate((panel) => {
    const rgb = value => value.match(/[\d.]+/g).map(Number);
    let backdrop = panel;
    while (backdrop.parentElement && (rgb(getComputedStyle(backdrop).backgroundColor)[3] ?? 1) === 0) backdrop = backdrop.parentElement;
    const background = getComputedStyle(backdrop).backgroundColor;
    const luminance = color => {
      const c = rgb(color).slice(0, 3).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
      return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
    };
    const targets = panel.querySelectorAll("h3,p,svg");
    const metrics = [...(targets.length ? targets : [panel])].map(element => {
      const style = getComputedStyle(element), fg = luminance(style.color), bg = luminance(background);
      return { tag: element.tagName.toLowerCase(), color: style.color, ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05), fontSize: parseFloat(style.fontSize) };
    });
    return { scheme: document.documentElement.dataset.scheme, dark: document.documentElement.classList.contains("dark"), width: innerWidth, background, metrics };
  });
  for (const metric of result.metrics) {
    const label = `${view}/${result.scheme}/${result.width}/${metric.tag}`;
    if (result.dark) assert.ok(metric.ratio >= (metric.tag === "svg" ? 3 : 4.5), `${label}: contrast ${metric.ratio.toFixed(2)}:1`);
    else assert.equal(metric.color, metric.tag === "h3" ? "rgb(35, 61, 67)" : "rgb(114, 129, 126)", `${label}: approved light color changed`);
    if (metric.tag !== "svg") assert.ok(metric.fontSize >= 16, `${label}: body text too small`);
  }
  return { view, ...result };
}
