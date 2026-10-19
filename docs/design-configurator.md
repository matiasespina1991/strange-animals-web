# Vinyl label configurator

Route: `/identity/design-configurator`, behind the existing Identity access gate.

## Editing

- Independent sides A/B; up to 50 layers per side.
- Text, circular text, and PNG/JPEG/WebP images (up to 5 MB each).
- Add, rename, duplicate, reorder, hide, delete, and reset layers. Undo/redo is
  available for all design changes; typing and slider drags are grouped.
- Drag straight text/images to position; drag circular text to rotate. Arrow
  keys nudge the selection (Shift: larger steps). Circular size/spacing changes
  never alter its radius, angular position, or path anchor.
- Circular paths support upper/lower orientation, 30–350° arcs, radius,
  rotation, and start/center/end anchors. Overset text is warned about, not resized.
- Font picker defaults to Paragraph / Standard and Condensed / Narrow. Search
  spans all enabled families. Samples load near the viewport. Variants and
  configurator-specific favorites are available.

## Persistence

Projects are local, not stored in Firestore. Automatic recovery uses
`sa-label-design-recovery-v2`; explicit Save/Open uses `sa-label-design-draft`.
Import/export JSON provides portable backups. IDs for selected fonts and
variants are saved; runtime font-family names are resolved again on opening.
The importer validates layer counts, dimensions, colors, and embedded image
types. Old four-layer drafts are accepted. Storage quota failures are visible
and do not prevent downloading JSON.

## Exports

- SVG: vector, editable text, embedded fonts/images, exact millimeter dimensions.
- PNG: transparent, pixel dimensions calculated at 300 pixels per inch.
- Print / PDF: current side through the browser's print dialog; use 100% scale
  and no margins/headers/footers. Confirm custom paper size in the print UI.
- SVG/PNG can export both sides as separate files. Allow multiple downloads.
- Bleed is optional and expands the paper color beyond the trim circle. The
  center hole is transparent; editor and safe-area guides never export.

Exports use RGB and retain live text. They are not a CMYK conversion or an
outlined-font press proof. Verify the printer's template and font embedding
licenses before production. Export fails visibly rather than substituting an
unavailable explicitly chosen catalog font.

## Verification

`node scripts/test-design-configurator.mjs` checks history, grouping, import
validation, legacy migration, and circular geometry. Browser tests additionally
cover responsive layouts, layer editing, images, JSON, SVG dimensions and font
embedding, PNG size/transparency, and the print document.
