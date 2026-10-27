# Versioned 3D model shares

## Identity and data model

- Saved gallery version UUID = public `sharedModels/{modelId}` UUID. Loading or saving a different version changes this ID.
- Unsaved designs use one in-memory draft UUID, replaced when a new template/project is started. Existing draft shares are not migrated or deleted when saving a gallery version.
- Binary: `media/public/shared-models/{ownerUid}/{modelId}/{fileName}`. Replacement preserves ID, filename, path, owner and creation time; only title and byte size metadata may change.
- Shared documents contain public model metadata only, not the private design JSON. Queries remain restricted to the current owner's models.
- Unchanged repeated clicks within the preview reopen the cached link. Changing the design or pressing preset invalidates that cached result; regenerating overwrites the same version model.
- Opening a previously generated URL resolves the current file. Uploads use `no-cache, max-age=0` to avoid serving obsolete binary contents.

## Failure and concurrency

Uploads and document writes span two Firebase services, not an atomic transaction. A metadata failure during replacement must never delete the existing binary. Retrying reuses the same ID/path. Simultaneous updates by the same owner are last-writer-wins; both resolve to one model, not duplicate records.

The previous random-ID shares remain intact; this change does not erase historical duplicates. Gallery design versions themselves remain immutable.

## Checks

`scripts/test-versioned-model-share.mjs` covers same-version replacement, different-version separation, owner checks, preservation of creation time, cache headers, and retaining the binary after metadata failure.

`scripts/test-design-gallery-rules.mjs` covers owner updates, denial of foreign/anonymous overwrites, immutable ownership/date/path, required fields, extra fields, invalid types/sizes, public lookup of missing IDs, and GLB replacement constraints. These are targeted regression checks, not a comprehensive security audit.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for owner-only model replacement with validated metadata and immutable identity fields. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.
