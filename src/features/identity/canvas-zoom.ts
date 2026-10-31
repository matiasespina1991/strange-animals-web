type Point = {x: number; y: number};
export type CanvasView = {zoom: number; viewOffset: Point};

/** Anchor coordinates are pixels relative to the canvas transform origin. */
export function zoomCanvasAt(view: CanvasView, requestedZoom: number, anchor: Point): CanvasView {
  const zoom = Math.round(Math.max(60, Math.min(1200, requestedZoom)));
  if (zoom === view.zoom) return view;
  const ratio = zoom / view.zoom;
  return {
    zoom,
    viewOffset: {
      x: anchor.x - (anchor.x - view.viewOffset.x) * ratio,
      y: anchor.y - (anchor.y - view.viewOffset.y) * ratio,
    },
  };
}
