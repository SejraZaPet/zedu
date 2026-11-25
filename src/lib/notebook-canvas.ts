/**
 * Bezpečná velikost interního bitmapového plátna sešitu.
 * CSS velikost stránky se nemění; omezuje se jen rozlišení, aby dva překrývající
 * se canvasy při vysokém DPR a přiblížení nevyčerpaly paměť tabletu.
 */
export const NOTEBOOK_CANVAS_MAX_EDGE = 4096;
export const NOTEBOOK_CANVAS_MAX_PIXELS = 8_000_000;

export interface NotebookCanvasSurface {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

export function notebookCanvasSurface(
  logicalWidth: number,
  logicalHeight: number,
  devicePixelRatio = 1,
): NotebookCanvasSurface {
  const width = Number.isFinite(logicalWidth) && logicalWidth > 0 ? logicalWidth : 1;
  const height = Number.isFinite(logicalHeight) && logicalHeight > 0 ? logicalHeight : 1;
  const requestedRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const ratio = Math.min(
    requestedRatio,
    NOTEBOOK_CANVAS_MAX_EDGE / width,
    NOTEBOOK_CANVAS_MAX_EDGE / height,
    Math.sqrt(NOTEBOOK_CANVAS_MAX_PIXELS / (width * height)),
  );
  const pixelWidth = Math.max(1, Math.floor(width * ratio));
  const pixelHeight = Math.max(1, Math.floor(height * ratio));

  return {
    width: pixelWidth,
    height: pixelHeight,
    scaleX: pixelWidth / width,
    scaleY: pixelHeight / height,
  };
}
