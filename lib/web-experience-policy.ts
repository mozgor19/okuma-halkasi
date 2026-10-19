export const TOUR_VERSION = 1;
export type TourState = "completed" | "dismissed";

export function validTourState(value: unknown): value is TourState {
  return value === "completed" || value === "dismissed";
}

// Pinch zoom is not a keyboard. Only an editing focus and a substantial loss
// of visible height may change the mobile form layout.
export function keyboardViewport(layoutHeight: number, height: number, offsetTop: number, scale: number, editing: boolean) {
  const valid = [layoutHeight, height, offsetTop, scale].every(Number.isFinite)
    && layoutHeight > 0 && height > 0 && offsetTop >= 0;
  return {
    open: valid && editing && Math.abs(scale - 1) < 0.05 && layoutHeight - height > 120,
    height: valid ? Math.round(height) : 0,
    top: valid ? Math.round(offsetTop) : 0,
  };
}
