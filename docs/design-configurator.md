# Vinyl Designer Configurator

Image properties use compact crop fields and color swatches. Rounded corners follow the cropped rectangle, not the original image bounds. Barcodes have independent bars/text and background colors; SVG assets have a fill override. Color inversion is only available for Strange Animals brand logos. Asset roles persist when layers are renamed; older layers are recognized by their original asset names. These settings are shared by preview and export.

Route: `/identity/vinyl-designer-configurator`, behind the existing Identity access gate. The former `/identity/design-configurator` URL redirects here.

## Editing

- Mobile global color rows and Ink color use available width to reveal more presets, keeping the + overflow palette. Preset buttons have fixed square dimensions and cannot shrink into ovals. Ink color has a dedicated featured set of neutral and vivid inks plus the complete expanded palette; its label sits above the row to leave more room for colors.

- The sun/moon button at the far right of the header toggles a scoped light/dark UI theme. It defaults to light and remembers the choice in `sa-design-configurator-theme`, independently of project JSON and undo history. Dark mode themes desktop/mobile controls, drawers and dialogs; artwork, color swatches and asset previews retain their actual colors. UI color literals use semantic CSS variables with original light colors as fallbacks.

- Content includes compact aa / Aa / AA actions for lowercase, title case and uppercase, preserving whitespace and line breaks. Each action is undoable.
- Text Opacity (0–100%) sits before the 3D controls and applies once to the complete straight/circular text element, including its effects. Selection guides remain opaque. It persists in projects, renders in SVG/PNG/PDF and is exported as editable PSD layer opacity without baking it twice.
- Focus > Blur applies 0–40 px of defocus to any selected text, circular text or image, including the complete 3D effect. Zero disables blur; selection guides stay sharp. Blur persists in saved projects and SVG/PNG/PDF exports. Blurred PSD layers are rasterized to preserve their appearance; unblurred text can still use vector outlines.

- Independent sides A/B; up to 50 layers per side.
- Text, circular text, PNG/JPEG/WebP images (up to 5 MB each), and SVG assets from the public Hvnter/Bitmancer library.
- Straight and circular text layers support two static 3D effects: segmented cylinder and layered extrusion, independently or combined. Circular text retains its arc, alignment and rotation; cylinder projects clipped slices of the complete curved text instead of flattening its textPath. Disabling both effects restores the original 2D arc. Effects are static and do not animate.
- Text contrast can be Normal or Difference. Difference uses white text with a Difference blend against the artwork below; the selected mode is preserved in SVG, PNG/PDF rendering, and PSD.
- Cylinder's Tilt control (-75° to +75°) inclines the band vertically. Zero preserves the old projection; the saved inclination is shared by the preview and all export formats.
- Text size supports 3–3000 px in both the numeric input and slider. Cylinder and Extrusion can be enabled independently or together; every extrusion copy retains the cylinder projection and tilt.
- Extrusion Fade accepts 0–300% in the numeric field; the slider keeps its 0–100% range. At 0% all copies are opaque; at 100% the farthest is transparent. Higher values fade copies sooner, clamped to zero opacity. The front face is unaffected. These settings persist in JSON/recovery and are shared by SVG/PNG/PDF and rasterized PSD effects.
- Combined effects limit depth steps according to segment count (up to 1536 text slices per element). The Steps control shows this limit to keep editing responsive; normal extrusion still supports up to 200 steps.
- Extrusion's Depth blur (0–40 px, default 0) increases blur toward the farthest copies while leaving the front face untouched. Copies are batched into at most six far-to-near levels instead of creating a blur pass for every copy. Works with Fade, Cylinder and circular text; saved in JSON and rendered consistently by the export pipeline. The separate Focus > Blur still applies to the entire element.
- Cylinder's Back blur (0–40 px) independently softens the farthest panels and leaves front panels in focus. Close cylinder switches to a 360° transparent band and repeats the text with a dot separator without editing Content. Open cylinder restores the stored Max arc. Back panels are mirrored and painted before front panels. Circular source text retains its textPath and fills its circumference in closed mode. Back blur and extrusion depth blur share grouped passes (up to 36 for the extruded volume plus six on the front cylinder), rather than applying filters per copy. All settings persist and export with the artwork.
- Cylinder and Extrusion toggles preserve each layer's last settings, including when both effects are off. Remembered settings are saved with the project, duplicated with the layer and included in undo/redo. Cylinder's combined Steps cap only limits the active rendering; disabling Cylinder restores the requested extrusion Steps. Explicitly resetting a layer clears its remembered effects.
- Cylinder's Back shading accepts 0–250% in the numeric field, with a 0–100% slider and default 70% to preserve previous designs. Zero retains the ink color; 100% makes a fully rear-facing panel black. Higher values darken sooner, clamped at black. The directly front-facing panel retains its color. Works with open/closed cylinders, circular text and extrusion, without adding render passes.
- Cylinder's Back transparency accepts 0–400% in the numeric field, with a 0–100% slider and default 0. It fades panels progressively with depth: the front retains its opacity and a fully rear-facing panel is transparent at 100%. Higher values fade sooner, clamped to zero opacity. It combines multiplicatively with layer opacity and extrusion Fade, is remembered when toggled off, and persists/exports without adding filters.
- The font picker is 1 rem wider than its previous 329 px base, still capped by the viewport; collection tabs keep their labels and counts compact.
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

## Assets

- Assets, next to Arc text, opens the fixed branding library. Choose a logo to
  insert it on the active side with the same controls as an uploaded image.
- The Assets library also browses Hvnter's nested asset folders and opens
  Bitmancer's Y2K icon set directly. SVG assets are sanitized, then embedded in
  the project so saved drafts and exports remain portable.
- Create barcode opens a live preview with EAN-13, UPC-A and CODE128 formats.
  Invalid values/check digits block insertion. The code is generated locally;
  this does not register or assign a product identifier.
- Logos, barcodes, and inserted SVG assets are embedded in project JSON and
  exports. Barcodes have white quiet zones; preserve them and test a printed
  sample before production. Each insertion can be undone/redone.

## Persistence

Projects are local, not stored in Firestore. The asset catalog itself is a
public Firestore manifest pointing to public Storage objects. Automatic recovery uses
`sa-label-design-recovery-v2`; explicit Save/Open uses `sa-label-design-draft`.
Import/export JSON provides portable backups. IDs for selected fonts and
variants are saved; runtime font-family names are resolved again on opening.
The importer validates layer counts, dimensions, colors, and embedded image
types. Old four-layer drafts are accepted. Storage quota failures are visible
and do not prevent downloading JSON.

## Exports

- Photoshop PSD: separate image/shape layers at 600 PPI (100 mm ≈ 2362 px). Plain text becomes vector
  outlines; 3D-effect text is rasterized per element to preserve its projection. Font bytes for
  outlined text are embedded/decoded during export, not
  resolved from the recipient's installed fonts. OTF/TTF/WOFF are supported;
  unsupported font files and contextual scripts produce an error instead of
  silently substituting raster text. Missing glyphs use the embedded default
  fonts (Alte DIN Input, then Berlin Type Office) per character, with a console
  warning; export fails only if none contains that character. Per-layer ink bleed is retained
  as an appearance layer alongside a hidden outline source. The document has a
  shared trim/center-hole mask. This exporter still needs a visual roundtrip
  check in real Photoshop; automated tests cover PSD structure/vector paths.

- SVG: vector, editable text, embedded fonts/images, exact millimeter dimensions.
- PNG: transparent, pixel dimensions and physical density metadata at 600 PPI.
- Print / PDF: current side through the browser's print dialog; use 100% scale
  and no margins/headers/footers. Confirm custom paper size in the print UI.
- SVG/PNG can export both sides as separate files. Allow multiple downloads.
- SVG/PNG can export both sides as separate files. Allow multiple downloads.
- 3D-effect layers are preserved in SVG, PNG and PDF. In PSD they are separate raster layers; plain text continues to use vector outlines.
- Bleed is optional and expands the paper color beyond the trim circle. The
  center hole is transparent; editor and safe-area guides never export.

Exports use RGB. SVG/PDF retain live text; PSD uses outlined shape layers.
Exports use RGB. SVG/PDF retain live text; PSD uses outlined shape layers for
plain text. 3D-effect layers are rasterized separately in PSD to preserve their
static projection. These files are not a CMYK press proof. Verify the printer's template and font embedding
licenses before production. Export fails visibly rather than substituting an
unavailable explicitly chosen catalog font.

## Verification

`node scripts/test-design-configurator.mjs` checks history, grouping, import
validation, legacy migration, and circular geometry.
`node scripts/test-configurator-preview-auth.mjs` checks palette preview versus
commit, dirty-project detection and independent account initialization with a
mocked Firebase SDK. `node scripts/test-psd-vectors.mjs` checks glyph-to-Bezier
conversion, embedded font decoding and layered PSD write/read.
Manual browser checks are still needed for responsive layouts, login with real
accounts, SVG/PNG rendering and Photoshop visual compatibility.

## Optional personal account

The header offers Sign-in before Typefaces collection. Email/password and
Google use a separate named Firebase client (`identity-account`) in the same
project. This intentionally does not replace the default client's shared
Identity access-key session. Sign-out only affects the personal account; it
does not reset the current project or remove access granted by the key.

No cloud project storage, font-upload permissions, database rules or storage
rules were added or changed. Existing editor functionality remains available
without a personal login. Future user-owned data must use the personal auth
session and appropriate backend rules, never the shared access-key identity.

Before live verification, check Firebase Console → Authentication:

- Enable Email/Password and Google providers if not enabled already.
- Authorize `localhost` and production hostnames (no protocol/port) for Google.
- Test sign-in, refresh persistence and sign-out with a real test account.

Provider settings were not deployed/changed by this implementation. The UI
reports provider-disabled, unauthorized-domain, blocked-popup and network
errors without showing passwords or raw Firebase error payloads.
