import assert from "node:assert/strict";

export async function checkFooterLayout(page) {
  const layout = await page.evaluate(() => {
    const footer = document.querySelector(".main-area>.footer");
    const content = document.querySelector("main.content");
    const main = document.querySelector(".main-area");
    if (!footer || !content || !main) return null;
    const footerRect = footer.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const bottomPadding = Number.parseFloat(getComputedStyle(main).paddingBottom) || 0;
    return {
      viewportHeight: innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      footerBottom: footerRect.bottom + scrollY,
      footerTop: footerRect.top + scrollY,
      footerHeight: footerRect.height,
      contentBottom: contentRect.bottom + scrollY,
      bottomPadding,
      position: getComputedStyle(footer).position,
    };
  });
  assert.ok(layout, "Application footer and content must be present");
  assert.ok(layout.footerHeight > 0, "Footer must remain visible");
  assert.ok(!["fixed", "absolute", "sticky"].includes(layout.position), "Footer must follow the content without overlaying it");
  assert.ok(layout.contentBottom <= layout.footerTop + 1, "Footer must not overlap the content");
  const gap = layout.documentHeight - layout.footerBottom - layout.bottomPadding;
  assert.ok(Math.abs(gap) <= 2, `Unexpected empty space below the footer: ${gap}px`);
  assert.ok(layout.footerBottom + layout.bottomPadding >= layout.viewportHeight - 1, "Short pages must fill the viewport");
  return layout;
}
