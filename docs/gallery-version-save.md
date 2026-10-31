# Save and version history

- **Save** replaces the opened version and preserves its ID, version number and creation date.
- **Save as new version** adds `latestVersion + 1` and opens that new version.
- **Save as new project** starts a different project at version 1.
- A first Save on an unsaved design creates project/version 1.
- Saving an older version does not promote it or replace the latest version's gallery preview.

Overwrite uploads five immutable files to a fresh snapshot UUID under the same owner/project prefix, then calls `saveDesignVersion`. The authenticated callable checks ownership through the authenticated UID namespace, project deletion status, uploaded MIME/size, original project title and original snapshot path before atomically swapping references. Version metadata is still not directly writable from the browser. Cached private GLB references are invalidated; public model IDs remain stable and are refreshed when explicitly shared again.

Old snapshot files are retained until the existing durable project deletion removes the entire project prefix. They are not extra versions and are not displayed in history. Failed/ambiguous callable responses do not trigger client deletion of potentially committed files. Cleanup of superseded snapshots can be added later with a durable retention policy.

The new callable must be deployed before the updated Save UI is used. No Firestore or Storage rules need loosening. Firebase Authentication and namespace ownership are mandatory inside the handler.

Deployment created `savedesignversion` but the organization policy rejected the public invoker binding. Browser access is blocked until the owner explicitly authorizes disabling Cloud Run's invoker IAM check on this endpoint only, matching the existing authenticated rename/deletion callable transport. The source keeps `invoker: private`; do not change the organization's domain restriction or grant `allUsers`.

Regression: `node scripts/test-gallery-save-mode.mjs` and `npm run test:configurator`.
