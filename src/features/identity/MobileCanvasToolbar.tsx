import { Box, Disc3, Grid2X2 } from "lucide-react";
import type { LabelSide, LabelSurface } from "./design-configurator-model";
import { SleeveSurfaceIcon } from "./SleeveSurfaceIcon";

type MobileCanvasToolbarProperties = {
  surface: LabelSurface;
  side: LabelSide;
  guides: boolean;
  previewBusy: boolean;
  onSurfaceChange: (surface: LabelSurface) => void;
  onSideChange: (side: LabelSide) => void;
  onToggleGuides: () => void;
  onOpenPreview: () => void;
};

export function MobileCanvasToolbar({
  surface,
  side,
  guides,
  previewBusy,
  onSurfaceChange,
  onSideChange,
  onToggleGuides,
  onOpenPreview,
}: MobileCanvasToolbarProperties) {
  return (
    <div
      className="dc-mobile-canvas-toolbar"
      role="toolbar"
      aria-label="Canvas controls"
    >
      <div
        className="dc-mobile-toolbar-segment dc-mobile-toolbar-side"
        role="group"
        aria-label="Record side"
      >
        {(["A", "B"] as const).map((nextSide) => (
          <button
            key={nextSide}
            type="button"
            aria-pressed={side === nextSide}
            onClick={() => {
              onSideChange(nextSide);
            }}
          >
            Side {nextSide}
          </button>
        ))}
      </div>
      <div
        className="dc-mobile-toolbar-segment"
        role="group"
        aria-label="Surface"
      >
        <button
          type="button"
          aria-pressed={surface === "cookie"}
          onClick={() => {
            onSurfaceChange("cookie");
          }}
        >
          <Disc3 size={12} aria-hidden="true" />
          Cookie
        </button>
        <button
          type="button"
          aria-pressed={surface === "sleeve"}
          onClick={() => {
            onSurfaceChange("sleeve");
          }}
        >
          <SleeveSurfaceIcon size={12} />
          Sleeve
        </button>
      </div>
      <button
        className="dc-mobile-toolbar-guides"
        type="button"
        aria-pressed={guides}
        aria-label="Guides"
        onClick={onToggleGuides}
      >
        <Grid2X2 size={14} aria-hidden="true" />
        <span>Guides</span>
      </button>
      <button
        className="dc-mobile-toolbar-preview"
        type="button"
        aria-label="Open 3D sleeve preview"
        title="3D sleeve preview"
        disabled={previewBusy}
        onClick={onOpenPreview}
      >
        <span className="dc-preview-3d-icon" aria-hidden="true">
          <Box size={18} />
          <span>3D</span>
        </span>
      </button>
    </div>
  );
}
