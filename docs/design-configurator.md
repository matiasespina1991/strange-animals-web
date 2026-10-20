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

## Assets

- Assets, next to Arc text, opens the fixed branding library. Choose a logo to
  insert it on the active side with the same controls as an uploaded image.
- Create barcode opens a live preview with EAN-13, UPC-A and CODE128 formats.
  Invalid values/check digits block insertion. The code is generated locally;
  this does not register or assign a product identifier.
- Logos and barcodes are embedded PNG images, retained in project JSON and
  exports. Barcodes have white quiet zones; preserve them and test a printed
  sample before production. Each insertion can be undone/redone.

## Persistence

Projects are local, not stored in Firestore. Automatic recovery uses
`sa-label-design-recovery-v2`; explicit Save/Open uses `sa-label-design-draft`.
Import/export JSON provides portable backups. IDs for selected fonts and
variants are saved; runtime font-family names are resolved again on opening.
The importer validates layer counts, dimensions, colors, and embedded image
types. Old four-layer drafts are accepted. Storage quota failures are visible
and do not prevent downloading JSON.

## Exports

- Photoshop PSD: separate image/shape layers at 300 PPI. Text becomes vector
  outlines, not live type. Font bytes are embedded/decoded during export, not
  resolved from the recipient's installed fonts. OTF/TTF/WOFF are supported;
  unsupported fonts, contextual scripts and missing glyphs produce an error
  instead of silently substituting raster text. Per-layer ink bleed is retained
  as an appearance layer alongside a hidden outline source. The document has a
  shared trim/center-hole mask. This exporter still needs a visual roundtrip
  check in real Photoshop; automated tests cover PSD structure/vector paths.

- SVG: vector, editable text, embedded fonts/images, exact millimeter dimensions.
- PNG: transparent, pixel dimensions calculated at 300 pixels per inch.
- Print / PDF: current side through the browser's print dialog; use 100% scale
  and no margins/headers/footers. Confirm custom paper size in the print UI.
- SVG/PNG can export both sides as separate files. Allow multiple downloads.
- Bleed is optional and expands the paper color beyond the trim circle. The
  center hole is transparent; editor and safe-area guides never export.

Exports use RGB. SVG/PDF retain live text; PSD uses outlined shape layers.
They are not a CMYK press proof. Verify the printer's template and font embedding
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
