# Shared model metadata

Public UUID model pages use the same title/description/Open Graph/Twitter tags as release pages. A Hosting function inserts public model metadata into the built SPA HTML before returning it, so link crawlers do not need JavaScript.

- Title: `3D MODEL | Strange Animals | {project name}`.
- Neutral description of the interactive model, materials and finishes.
- Sharing from the designer uploads a 1200 × 630 PNG capture to the owner's existing public model directory. Re-sharing a changed version replaces its preview.
- `/_model-preview/{id}` serves that PNG only after verifying the model is public. No private gallery documents or account data are exposed.
- Existing models without a capture use the brand image until shared again. No historical files are modified automatically.

Deployment requires **Storage rules, sharedModelPage Function and Hosting** together. The function needs public HTTP transport for link crawlers; do not alter the private deletion/rename workers. Hosting's `route-meta/model-shell.html` must come from the same build as the application assets. No deployment was performed as part of implementation.

Run `node scripts/test-model-page-metadata.mjs`, app typecheck and the Functions build before deployment. Verify a production UUID URL returns model-specific tags with JavaScript disabled and its preview endpoint returns `image/png`.
