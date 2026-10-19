# Font catalog uploads

The typeface catalog is uploaded directly from `fonts to upload/`. That folder
is ignored by Git and is the only staging area for catalog fonts.

Do not copy catalog fonts into `public/media/fonts/`. Files in `public/` are
served with the website and are reserved for fonts that the web UI loads through
`@font-face` (for example, Facit, Microgramma, and TerminalVision).

## Source structure

Each top-level folder in `fonts to upload/` becomes one family in
Identity → Typography → Typefaces. Keep all variants of a family inside that
folder. Use one top-level folder per family when separate catalog entries are
wanted.

`fonts to upload/_alreadyUploaded/` is an archive for sources already present
in the remote catalog. It is ignored by the sync script and must not be used as
a family source.

## Publish

### Per-family preview spacing

The optional numeric Firestore field `fonts/{familyId}.previewLineHeightExtraRem`
adds a non-negative amount in `rem` to the preview's selected line-height.
Missing or invalid values default to zero. It affects rendered previews only,
including image overlays and the size-slider ghost, not the font files or the
global line-height control. For example, `8` adds `8rem` to every preview line.
The sync script's field-level updates preserve this setting.

`previewLineHeightExtra` adds a non-negative, unitless amount to the selected
line-height multiplier instead (e.g. `2.5` changes `1` to `3.5`). It defaults
to zero and can be combined with `previewLineHeightExtraRem`.

`previewLetterSpacingExtraEm` adds non-negative letter spacing in `em` to the
preview's selected value, including image overlays and the size-slider ghost.
Missing or invalid values default to zero; font files remain unchanged.

This procedure is mandatory for every font addition. A font is **not uploaded**
until it exists in both Firebase Storage and Firestore and the verification
command finishes with zero missing entries. Do not report an upload as complete
before that verification has passed.

1. Preview the catalog without changing Firebase:

```bash
npm run sync:fonts
```

2. Upload fonts to Firebase Storage and register them in Firestore in the same
command. Never upload to Storage without writing Firestore metadata:

```bash
npm run sync:fonts -- --upload-storage --write-firestore
```

3. Verify Storage and Firestore immediately after every upload:

```bash
npm run audit:fonts
```

The audit must report `"passed": true`, with empty `missingStorage` and
`missingFirestore` arrays. If it reports missing metadata, repair it before
considering the upload complete:

```bash
node scripts/repair-font-storage-metadata.mjs --apply
```

For a particular family, also verify its Firestore document and all file
variants before reporting success. This is a release-critical checklist: the
typeface application depends on the remote files and their database records.

The script marks uploaded families as enabled. Script-specific categories can
be assigned through `PARENT_CATEGORY_OVERRIDES` in
`scripts/sync-font-catalog.mjs`.
