# Shared model metadata

Public UUID model pages use the same title/description/Open Graph/Twitter tags as release pages. A Hosting function inserts public model metadata into the built SPA HTML before returning it, so link crawlers do not need JavaScript.

## Production status — 2026-10-31

`sharedModelPage` is deployed and publicly reachable. With explicit owner
authorization, the Cloud Run invoker IAM check was disabled only for
`sharedmodelpage`; no database or storage permissions were broadened.
The UUID Hosting rewrite now uses the verified function. Hosting was released
by cloning the current live version and changing only this rewrite, preserving
all deployed assets (version `5fa9473e33afa563`). The preview endpoint returned
HTTP 200 and PNG for 22REC009. Previously cached social previews may require
a fresh URL query or time to refresh.

- Title: `Strange Animals | 3D Record | {project name}`.
- Neutral description of the interactive model, materials and finishes.
- Sharing from the designer uploads a 1200 × 630 PNG capture to the owner's existing public model directory. Re-sharing a changed version replaces its preview.
- `/_model-preview/{id}` serves that PNG only after verifying the model is public. No private gallery documents or account data are exposed.
- Existing models without a capture use the brand image until shared again. No historical files are modified automatically.

Deployment requires **Storage rules, sharedModelPage Function and Hosting** together. The function needs public HTTP transport for link crawlers; do not alter the private deletion/rename workers. Hosting's `route-meta/model-shell.html` must come from the same build as the application assets. The organization rejects `allUsers` IAM bindings: preserve the explicitly authorized service-level invoker-check exemption rather than changing organization policy.

Run `node scripts/test-model-page-metadata.mjs`, app typecheck and the Functions build before deployment. Verify a production UUID URL returns model-specific tags with JavaScript disabled and its preview endpoint returns `image/png`.
