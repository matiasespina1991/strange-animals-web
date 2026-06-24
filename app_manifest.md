# Strange Animals Web App Manifest

This file is the architectural entry point for future work on this project. Any AI or developer touching the codebase should read this first.

## Project Identity

- App root: `strange-animals-web`
- Firebase project ID: `strange-animals-web`
- Firebase auth domain: `strange-animals-web.firebaseapp.com`
- Firebase Storage bucket: `strange-animals-web.firebasestorage.app`
- Firebase Storage CORS config: `firebase-storage-cors.json`
- Frontend: React + Vite + TypeScript
- Backend: Firebase Functions v2 + TypeScript, currently only health endpoint
- Database: Cloud Firestore
- Object storage: Firebase Storage
- Hosting target: Firebase Hosting, serving `dist`
- Firestore default database: `(default)` in `europe-west3`

## Regional Policy

All backend compute and database resources for this project must be created in Europe.

- Firebase Functions region: `europe-west3` when functions are needed
- Firestore `(default)` location: `europe-west3`
- New Storage buckets must be created in a European location.
- Do not add new backend resources in `us-central1` or any non-European region.

If a Firebase default would create a resource in the United States, override it explicitly before deploy.

## Current Firebase Surface

### Known Operational State

As of 2026-06-24, media loading uses direct public Firestore reads plus Firebase Storage SDK `getDownloadURL`. The old callable media function is no longer part of the app flow.

### Functions

Source: `functions/src/index.ts`

- `health`: HTTP health endpoint.

Do not add a Firebase Function for public media lookup unless the media becomes private or needs server-only authorization logic.

### Frontend Firebase Client

Source: `src/lib/firebase.ts`

Exports:

- `firebaseApp`
- `firebaseDb`
- `firebaseStorage`
- `analyticsPromise`

## Media Architecture

Media access is intentionally centralized.

Frontend components must not call Firebase APIs directly and must not hardcode download URLs. Components consume media through:

- `src/media/react/MediaProvider.tsx`
- `src/media/infrastructure/firebase-media-repository.ts`
- `src/media/domain/media-assets.ts`

Runtime flow:

1. React starts inside `MediaProvider`.
2. `MediaProvider` calls `getHomeMediaAssets()`.
3. The frontend media repository reads Firestore domain collections.
4. Firestore documents contain `storagePath` values.
5. The frontend media repository converts Storage paths into public download URLs through Firebase Storage SDK `getDownloadURL`.
6. UI components receive resolved media URLs through `useMediaAssets()`.

`src/media/domain/media-assets.ts` contains a minimal non-local fallback only. Production media comes from Firebase Storage through the centralized media repository.

## Firestore Data Model

Keep Firestore simple and domain-oriented. The primary collections are:

```text
tracks/{trackId}
webampSkins/{skinId}
images/{imageId}
siteContent/{sectionId}
```

The currently used media collections are `tracks`, `webampSkins`, and `images`.

### Shared Media Fields

Each media document stores the file path and editable metadata directly.

Required fields:

- `storagePath`: string. Example: `media/public/images/brand/logo/v1/strange-animals-transparent-logo.png`
- `contentType`: string. Example: `image/png`
- `enabled`: boolean
- `label`: string
- `version`: number
- `sortOrder`: number
- `updatedAt`: timestamp

Recommended fields for future scale:

- `createdAt`: server timestamp
- `createdBy`: uid or system actor
- `checksum`: content hash for immutable assets
- `sizeBytes`: numeric byte size
- `metadata`: object for asset-specific data

Important rule: the database stores Storage paths, not generated download URLs. URLs are resolved from Storage at runtime.

### `images/{imageId}`

Current IDs:

- `logo`
- `og`
- `tade`
- `cd`
- `basketball-hoop`
- `coin`
- `cherry`

### `tracks/{trackId}`

Current IDs:

- `enya-caribbean-blue`
- `aphex-twin-tha`
- `bluejaye-beginning`
- `sillizium-coldsunset`
- `tade-kop-untitled`

Track-specific fields:

- `title`
- `artist`
- `homeKey`

### `webampSkins/{skinId}`

Current IDs:

- `lain`

Additional skins can be uploaded from `#/webamp-skin-uploader`. Uploaded skin documents use an empty `label` by default and store the `.wsz` object path in `storagePath`.

### `siteContent/{sectionId}`

Reserved for future editable site text and structured page content. Do not mix page copy into `tracks`, `images`, or `webampSkins`.

### Deprecated Collections

Do not use these for new work:

```text
mediaAssets/{assetId}
mediaManifests/{manifestName}
```

They were part of the initial migration design and are intentionally removed from the current flow.

## Storage Structure

Storage paths are versioned and grouped by domain:

```text
media/public/images/brand/logo/v1/strange-animals-transparent-logo.png
media/public/images/brand/og/v1/og-image.jpg
media/public/images/characters/tade/v1/tade.png
media/public/images/ui/cd/v1/cd.gif
media/public/images/ui/basketball-hoop/v1/basketball-hoop.png
media/public/images/ui/coin/v1/coin.png
media/public/images/ui/cherry/v1/cherry.webp
media/public/audio/tracks/enya-caribbean-blue-instrumental/v1/source.mp3
media/public/audio/tracks/aphex-twin-tha/v1/source.mp3
media/public/audio/tracks/bluejaye-beginning-live-mix-edit-low/v1/source.mp3
media/public/audio/tracks/sillizium-coldsunset/v1/source.mp3
media/public/audio/tracks/tade-kop-untitled/v1/source.mp3
media/public/webamp-skins/lain/v1/lain.wsz
media/public/webamp-skins/{skinId}/v1/{fileName}.wsz
```

Path rules:

- Use lowercase slug folders.
- Use version folders like `v1`, `v2`, `v3`.
- Do not overwrite production assets in place unless the asset is explicitly mutable.
- Prefer adding a new version folder and updating Firestore.
- Keep public readable media under `media/public`.
- Future private/admin-only media should use a separate prefix, for example `media/private`.
- Browser uploads are currently allowed only for `media/public/webamp-skins/{skinId}/v1/{fileName}` and should be replaced with authenticated/admin uploads before exposing the uploader publicly.

## Security Rules Status

Storage allows public reads under `media/public/**` and denies browser writes.
The bucket CORS config must allow app origins because Three.js/WebGL texture loading requires CORS headers from Storage.
Storage allows browser writes only for Webamp skin uploads under `media/public/webamp-skins/**`.

Firestore allows public reads for public content collections and denies browser writes.

- Public client reads media metadata only through the centralized frontend media repository.
- Public client does not write `images`.
- Public client does not write `tracks`.
- Public client can create/update `webampSkins` only for the uploader workflow.
- Admin writes happen through trusted backend/admin tooling.
- Storage public reads currently remain allowed for `media/public` to support public assets such as Open Graph images.

## React Structure

Important folders:

```text
src/features/home
src/features/webamp-skins
src/media/domain
src/media/infrastructure
src/media/react
src/lib
src/store
src/components/ui
```

Rules for future frontend work:

- Feature UI lives under `src/features/{featureName}`.
- Shared domain contracts live under `src/{domain}/domain`.
- Firebase and network implementations live under `infrastructure`.
- React providers/hooks that bridge domain data to UI live under `react`.
- Components should consume hooks/providers, not Firebase SDKs directly.
- Avoid calling backend services directly from page components.

## Current Home Media Consumers

The home experience consumes media from the centralized provider through `useMediaAssets()`.

Relevant files:

- `src/features/home/components/TadeGame.tsx`
- `src/features/home/components/BasketballHoop.tsx`
- `src/features/home/hooks/useTadeGameAudio.ts`
- `src/features/home/hooks/useTadeGameLoop.ts`
- `src/features/home/hooks/useThreeLogoScene.ts`
- `src/features/home/hooks/useWebamp.ts`
- `src/features/home/components/WebampSkinDialog.tsx`

Note: `useTadeGameAudio.ts` is the canonical audio hook name. Do not recreate `useTadeAudio.ts`.

Keyboard sequences:

- `skin`: opens the high-contrast Webamp skin picker.
- `winamp` / `winmp`: opens Webamp using the selected skin when one exists.
- `lain`: opens Webamp with the Lain skin and Lain track mode.

## Deployment Notes

Useful commands from the app root:

```bash
npm run build
npm run build --prefix functions
npx --cache .npm-cache firebase-tools@latest deploy --only storage --project strange-animals-web
npx --cache .npm-cache firebase-tools@latest deploy --only firestore:rules --project strange-animals-web
```

Global `firebase-tools` may be old on this machine. Prefer the `npx --cache .npm-cache firebase-tools@latest` form when deploy behavior looks inconsistent.

## Cleanup Checklist After Migration

Completed:

1. Removed `src/features/dev-media-uploader`.
2. Removed the uploader import/render from the app.
3. Removed temporary Storage write permission.
4. Replaced open Firestore development rules.
5. Removed Vite/static-copy behavior for local `images`, `audio`, and `webamp_skins`.

Remaining:

- Delete local media folders from the repo/worktree after confirming no local development task still needs them.

## Scaling Rules

- Store file paths in Firestore, never generated URLs.
- Add new asset families by extending `MediaAssets` first, then Firestore domain collections, then UI consumers.
- Add backend functions around use cases, not around pages.
- Use backend URL generation only for private media or authorization-sensitive workflows.
- Keep browser write access disabled outside temporary migrations.
- Version Storage objects instead of mutating production files.
- Prefer small, typed repository modules over direct SDK calls from components.
- Any region-sensitive backend change must explicitly state its Firebase region.
