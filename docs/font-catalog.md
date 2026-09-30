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

## Publish

Preview the catalog without changing Firebase:

```bash
npm run sync:fonts
```

Upload fonts to Firebase Storage and register them in Firestore:

```bash
npm run sync:fonts -- --upload-storage --write-firestore
```

The script marks uploaded families as enabled. Script-specific categories can
be assigned through `PARENT_CATEGORY_OVERRIDES` in
`scripts/sync-font-catalog.mjs`.
