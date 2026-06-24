# Strange Animals Web App Manifest

This file is the architectural entry point for future work on this project. Read it before changing code.

## Project Identity

- App root on this machine: `/Users/matiasespina/Documents/Projekte/strangeanimals/strange-animals-web`
- Firebase project ID: `strange-animals-web`
- Firebase auth domain: `strange-animals-web.firebaseapp.com`
- Firebase Storage bucket: `strange-animals-web.firebasestorage.app`
- Production domain: `https://strangeanimals.de` and `https://www.strangeanimals.de`
- Frontend: React + Vite + TypeScript
- Package manager: `pnpm@9.15.4`
- Hosting target: Firebase Hosting, serving `dist`
- Database: Cloud Firestore `(default)` in `europe-west3`
- Object storage: Firebase Storage
- Backend: Firebase Functions v2 + TypeScript, currently only a health endpoint

## Regional Policy

All backend compute and database resources must be created in Europe.

- Firebase Functions region: `europe-west3` when functions are needed.
- Firestore `(default)` location: `europe-west3`.
- New Storage buckets must be in a European location.
- Do not add backend resources in `us-central1` or other non-European regions.

## Routing

The app uses normal path routing, not hash routing.

Routes are selected in `src/App.tsx` through `src/hooks/usePathRoute.ts`.

Current routes:

```text
/                              -> HomePage
/webamp-skin-uploader           -> WebampSkinUploaderPage
/services/release-id-verifier   -> ReleaseIdVerifierPage
```

Firebase Hosting has an SPA rewrite in `firebase.json`:

```json
{"source":"**","destination":"/index.html"}
```

Do not reintroduce `#/...` routes unless there is a specific hosting constraint.

## Firebase Client

Source: `src/lib/firebase.ts`

Exports:

- `firebaseApp`
- `firebaseDb`
- `firebaseStorage`
- `analyticsPromise`

Firebase Web config values are public client config, not server secrets. Security depends on Firestore/Storage rules and Google Cloud API key restrictions.

## Media Architecture

Media loading is centralized. Components should not call Firebase SDKs directly for home media and should not hardcode generated download URLs.

Primary files:

- `src/media/react/MediaProvider.tsx`
- `src/media/infrastructure/firebase-media-repository.ts`
- `src/media/domain/media-assets.ts`

Runtime flow:

1. React starts inside `MediaProvider`.
2. `MediaProvider` calls `getHomeMediaAssets()`.
3. The repository reads domain-oriented Firestore collections.
4. Firestore documents store `storagePath`, not download URLs.
5. The repository resolves Storage paths with Firebase Storage SDK `getDownloadURL`.
6. Components consume URLs through `useMediaAssets()`.

`MediaProvider` shows a black loading screen only. It must not render the footer/signature during loading, otherwise the signature flashes before the home fade-in sequence.

## Firestore Data Model

Current public collections:

```text
images/{imageId}
tracks/{trackId}
webampSkins/{skinId}
siteContent/{sectionId}
```

Used by the media repository today: `images`, `tracks`, `webampSkins`.

Common media fields:

- `storagePath`: Storage object path, for example `media/public/images/brand/logo/v1/strange-animals-transparent-logo.png`
- `contentType`
- `enabled`
- `label`
- `version`
- `sortOrder`
- `updatedAt`

Recommended future fields:

- `createdAt`
- `createdBy`
- `checksum`
- `sizeBytes`
- `metadata`

Important rule: store Storage paths in Firestore, never generated download URLs.

### Images

Current IDs include:

```text
logo
og
tade
cd
basketball-hoop
coin
cherry
```

### Tracks

Current IDs include:

```text
enya-caribbean-blue
aphex-twin-tha
bluejaye-beginning
sillizium-coldsunset
tade-kop-untitled
```

Track-specific fields may include:

- `title`
- `artist`
- `homeKey`

### Webamp Skins

Collection: `webampSkins/{skinId}`

The app ships with `lain` as a known skin. Additional skins can be uploaded through:

```text
/webamp-skin-uploader
```

Uploader behavior:

- Uploads `.wsz` files to `media/public/webamp-skins/{skinId}/v1/{fileName}`.
- Writes a Firestore doc to `webampSkins/{skinId}`.
- `label` defaults to an empty string.
- `sourceFileName` is stored and used for display names.
- Internal IDs include a unique suffix to avoid overwrites; UI displays `label`, then `sourceFileName` without extension, then a cleaned ID fallback.

### Deprecated Collections

Do not use these for new work:

```text
mediaAssets/{assetId}
mediaManifests/{manifestName}
```

They were part of an earlier migration design and are not in the current app flow.

## Storage Structure

Public media is under `media/public` and uses versioned paths:

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

Rules:

- Use lowercase slug folders.
- Use version folders like `v1`, `v2`, `v3`.
- Prefer new version folders over overwriting production assets.
- Keep public readable media under `media/public`.
- Future private media should use a separate prefix such as `media/private`.

## Security Rules

### Firestore

`firestore.rules` currently allows:

- Public reads for `images`, `tracks`, `webampSkins`, `siteContent`.
- No client writes to `images`, `tracks`, or `siteContent`.
- Public create/update for `webampSkins` only when `storagePath` is a string under `media/public/webamp-skins/.*` and `enabled == true`.
- No deletes.

This public Webamp skin uploader is convenient but should become authenticated/admin-only before broad public exposure.

### Storage

`storage.rules` currently allows:

- Public reads under `media/public/**`.
- Browser writes only under `media/public/webamp-skins/{skinId}/{version}/{fileName}` with size under 10 MB.
- Everything else denied.

## CORS

Bucket CORS is configured in `firebase-storage-cors.json`, not through `firebase deploy --only storage`.

Current allowed origins include:

```text
http://localhost:5173
https://strange-animals-web.web.app
https://strange-animals-web.firebaseapp.com
https://strangeanimals.de
https://www.strangeanimals.de
```

Apply CORS with:

```bash
gcloud storage buckets update gs://strange-animals-web.firebasestorage.app --cors-file=firebase-storage-cors.json --project=strange-animals-web
```

CORS matters because Three.js/WebGL texture loading requires valid CORS headers from Storage.

## Home Experience

Important files:

```text
src/features/home/HomePage.tsx
src/features/home/components/BrandLogoExperience.tsx
src/features/home/components/SocialLinks.tsx
src/features/home/components/TadeGame.tsx
src/features/home/components/WebampLayer.tsx
src/features/home/components/WebampSkinDialog.tsx
src/features/home/hooks/useTadeGameAudio.ts
src/features/home/hooks/useThreeLogoScene.ts
src/features/home/hooks/useWebamp.ts
```

`useTadeGameAudio.ts` is the canonical audio hook name. Do not recreate `useTadeAudio.ts`.

### Home Fade-In

Framer Motion is used for fade-in only.

- Logo fades first.
- Links fade after the logo.
- Footer/signature fades after links start becoming visible.
- Do not animate position for these fade-ins unless explicitly requested.
- The footer/signature exists only in `HomePage`; do not duplicate it in loading/fallback providers.

## Webamp Behavior

Primary files:

```text
src/features/home/hooks/useWebamp.ts
src/features/home/components/WebampLayer.tsx
src/features/home/components/WebampSkinDialog.tsx
src/features/webamp-skins/webamp-skin-repository.ts
src/features/webamp-skins/WebampSkinUploaderPage.tsx
```

Shortcuts:

- `Alt+W`: open Webamp. On first Webamp open, also opens the skin picker.
- `Alt+S`: open the skin picker.
- `lain`: typed sequence opens Webamp in Lain mode.
- `tade`: typed sequence activates Tade game mode.

Do not use `Cmd+W`, `Cmd+S`, `Ctrl+W`, or `Ctrl+S`; those conflict with browser/OS shortcuts.

### Skin Picker UI

The skin picker is `WebampSkinDialog`.

Current behavior:

- Opens bottom-right by default.
- Draggable from the top header; cursor is `grab` / `grabbing`.
- Resizable vertically from a small bottom-right handle; cursor is diagonal `nwse-resize`.
- High-contrast black background, white border/text.
- No backdrop overlay.
- Skins are alphabetically sorted by display name.
- Hover previews a skin.
- Click confirms a skin and keeps the dialog open.
- Double click confirms and closes.
- Arrow Up/Down previews and navigates skins.
- Enter confirms the active skin and closes.
- Escape closes.
- Leaving the skin list or dialog restores the last confirmed skin.
- If no skin is confirmed, restore calls `onPreview(null)`, and Webamp returns to default via internal `LOAD_DEFAULT_SKIN` without recreating the Webamp instance.

The UI intentionally does not show a `default` row. Default is represented internally by `selectedSkin === null`.

## React Structure

Important folders:

```text
src/features/home
src/features/webamp-skins
src/features/release-id-verifier
src/media/domain
src/media/infrastructure
src/media/react
src/lib
src/store
src/components/ui
```

Rules:

- Feature UI lives under `src/features/{featureName}`.
- Shared domain contracts live under domain folders.
- Firebase/network implementations live under `infrastructure`.
- React providers/hooks that bridge domain data to UI live under `react`.
- Components should consume hooks/providers, not Firebase SDKs directly.
- Avoid direct backend calls from page components unless isolated behind a repository/service module.

## GitHub Actions Deployment

Workflow:

```text
.github/workflows/deploy-hosting.yml
```

On push to `main`, it:

1. Checks out the repo.
2. Enables Corepack and activates `pnpm@9.15.4`.
3. Sets up Node 24 with `actions/setup-node@v5` and pnpm cache.
4. Runs `pnpm install --frozen-lockfile`.
5. Runs `npm run build`.
6. Authenticates to Google Cloud with Workload Identity Federation via `google-github-actions/auth@v3`.
7. Runs `pnpm dlx firebase-tools deploy --only hosting --project strange-animals-web`.

No JSON service account key is used. The organization blocks service account key creation.

OIDC configuration:

- GitHub repo: `matiasespina1991/strange-animals-web`
- Project number: `536380283169`
- Workload identity pool: `github-actions`
- Provider: `github`
- Service account: `github-actions-hosting-deploy@strange-animals-web.iam.gserviceaccount.com`
- The provider condition restricts access to `assertion.repository == 'matiasespina1991/strange-animals-web'` and `assertion.ref == 'refs/heads/main'`.

## Commands

From the app root:

```bash
pnpm install --frozen-lockfile
npm run build
npm run dev
npm run build --prefix functions
npx --cache .npm-cache firebase-tools@latest deploy --only hosting --project strange-animals-web
npx --cache .npm-cache firebase-tools@latest deploy --only storage --project strange-animals-web
npx --cache .npm-cache firebase-tools@latest deploy --only firestore:rules --project strange-animals-web
```

For CORS, use `gcloud storage buckets update`, not Firebase deploy.

## Scaling Rules

- Store file paths in Firestore, never generated URLs.
- Add new asset families by extending `MediaAssets` first, then Firestore domain collections, then UI consumers.
- Add backend functions around use cases, not around pages.
- Use backend URL generation only for private media or authorization-sensitive workflows.
- Keep browser write access disabled outside intentional uploader workflows.
- Version Storage objects instead of mutating production files.
- Prefer small, typed repository modules over direct SDK calls from components.
- Any region-sensitive backend change must explicitly state its Firebase region.
