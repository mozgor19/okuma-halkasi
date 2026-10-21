import assert from "node:assert/strict";

export async function checkMeetingLayout(page) {
  const result = await page.evaluate(() => {
    const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
    const main = box('.meeting-main'), side = box('.meeting-side'), actions = box('.gallery-actions'), gallery = box('.gallery-empty,.photo-grid');
    const visible = [...document.querySelectorAll('.paper-card button,.paper-card label.upload-button,.paper-card input:not([type=file]),.paper-card textarea,.paper-card select')]
      .filter(el => el.getClientRects().length && el.getAttribute('aria-hidden') !== 'true' && getComputedStyle(el).visibility !== 'hidden');
    const controls = visible.map(el => {
      const r = el.getBoundingClientRect(), section = el.closest('.paper-card'), p = section.getBoundingClientRect(), style = getComputedStyle(section);
      return {
        inside: r.left >= p.left - 1 && r.right <= p.right + 1 && r.top >= p.top - 1 && r.bottom <= p.bottom + 1,
        clearBorders: [
          [style.borderLeftWidth, r.left - p.left], [style.borderRightWidth, p.right - r.right],
          [style.borderTopWidth, r.top - p.top], [style.borderBottomWidth, p.bottom - r.bottom],
        ].every(([border, gap]) => parseFloat(border) === 0 || gap >= 8),
      };
    });
    return { width: innerWidth, scheme: document.documentElement.dataset.scheme, mode: document.documentElement.dataset.colorMode,
      columns: side.left >= main.right - 1, dividerGap: side.left - Math.max(actions.right, gallery.right), controls };
  });
  const label = `${result.scheme}/${result.mode}/${result.width}`;
  assert.ok(result.controls.length && result.controls.every(c => c.inside), label + ': visible controls must stay inside their section');
  assert.ok(result.controls.every(c => c.clearBorders), label + ': controls need breathing room from section borders');
  if (result.width > 1250) assert.ok(result.columns, label + ': desktop meeting columns should be side by side');
  else assert.equal(result.columns, false, label + ': stacked meeting layout should stay stacked');
  if (result.columns) assert.ok(result.dividerGap >= 16, label + ': gallery controls/content must not touch the column divider');
  return { width: result.width, scheme: result.scheme, mode: result.mode, sideBySide: result.columns,
    dividerGap: result.columns ? result.dividerGap : null, visibleControls: result.controls.length };
}
