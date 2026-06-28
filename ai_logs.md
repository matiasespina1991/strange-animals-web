# AI Session Log (Handoff)

Date: 2026-06-28
Project: strange-animals-web

This file summarizes the code changes and adaptations made during the latest AI-assisted session so another AI can continue safely.

## 1) Home / Dialog / Layering Behavior

- Enabled DOOM shortcut in production (removed DEV-only guard for Alt+D).
  - File: src/features/home/HomePage.tsx

- Fixed dialog stacking inconsistencies by removing wrapper layers that interfered with z-order.
  - Removed `fixed inset-0` wrappers around dialogs where needed so `StrangeOsDialog` controls stacking directly.
  - Files updated:
    - src/features/home/components/DoomDialog.tsx
    - src/features/home/components/MinesweeperDialog.tsx
    - src/features/home/components/JspaintDialog.tsx

- Added reusable top-layer behavior for selected dialogs.
  - New prop in dialog shell: `forceTopLayer?: boolean`
  - Applies z-index boost while preserving internal stack ordering.
  - Enabled for:
    - DOOM main dialog
    - Minesweeper dialog
    - Paint dialog
  - Files:
    - src/features/home/components/StrangeOsDialog.tsx
    - src/features/home/components/DoomDialog.tsx
    - src/features/home/components/MinesweeperDialog.tsx
    - src/features/home/components/JspaintDialog.tsx

- Adjusted signature (bottom-right text) reveal delay.
  - Delay increased by +2s.
  - File: src/features/home/HomePage.tsx

## 2) Brand Logo + Social Links UX

- Decoupled social links from logo drag/resize position.
  - Social links no longer move when logo is dragged.
  - Social links no longer resize/reposition based on logo size CSS vars.
  - File: src/features/home/components/BrandLogoExperience.tsx

- Fixed logo resize interaction bug (stuck resizing after release).
  - Moved resize handling to window-level pointer listeners.
  - Stops reliably on pointerup/pointercancel/blur/lost capture.
  - File: src/features/home/components/BrandLogoExperience.tsx

- Updated logo clamp constraints.
  - Max size: 50vw
  - Min size: increased from 6rem to 7.8rem (30% larger)
  - File: src/features/home/components/BrandLogoExperience.tsx

- Initial animation timing tuning.
  - Added +1s delay to initial brand/logo appearance timing.
  - Made logo and social initial fade-ins slightly slower.
  - Kept signature timing separately controlled.
  - File: src/features/home/components/BrandLogoExperience.tsx

- Fixed social links initial misalignment caused by transform conflict.
  - Replaced Tailwind translate centering conflict with motion `x: '-50%'` in center mode.
  - File: src/features/home/components/BrandLogoExperience.tsx

- Removed social icon hover lift motion.
  - Icons no longer move upward on hover.
  - Easter-egg relocation motion kept.
  - File: src/features/home/components/SocialLinks.tsx

## 3) DOOM / Info / Other UI updates done in this phase

- DOOM main dialog kept separate from Info dialog and follows stack rules.
- Resizable and fullscreen/message wiring from previous work preserved.
- No major regressions introduced in this pass.

## 4) Staff Picks System (Winamp Skins)

### Routing / Admin Page

- Added route for staff picks page:
  - `/winamp-skins-stuff-picks`
  - File: src/App.tsx

- Added admin page for staff picks management table.
  - Lists skins from Firestore.
  - Per-row custom checkbox toggles `isStaffPick`.
  - File: src/features/webamp-skins/WinampSkinsStuffPicksPage.tsx

### Webamp Skin Repository Changes

- Extended skin models and list functions with staff-pick metadata.
  - `WebampSkin.isStaffPick`
  - `WebampSkinStaffPickRow.hasStaffPickProperty`
  - Added filter option `staffPicksOnly` for list in dialog.
  - File: src/features/webamp-skins/webamp-skin-repository.ts

- Added and currently kept (temporary utility) function:
  - `setMissingWebampSkinStaffPicksToTrue()`
  - Note: currently **not used by UI** after bulk button removal.
  - File: src/features/webamp-skins/webamp-skin-repository.ts

- Added console diagnostics in staff-picks page flow for per-row toggles.
  - Logs success/failure context to browser console.
  - File: src/features/webamp-skins/WinampSkinsStuffPicksPage.tsx

### Winamp Skin Dialog

- Added custom header toggle in dialog title bar:
  - Label: `Only staff picks`
  - Default: enabled
  - Custom square checkbox styling (non-native look)
  - File: src/features/home/components/WebampSkinDialog.tsx

- Prevented full dialog remount when toggling staff-picks filter.
  - Removed `setLoaded(false)` on in-dialog filter changes.
  - Keeps dialog state/position and only refreshes list.
  - File: src/features/home/components/WebampSkinDialog.tsx

### Bulk button status

- A temporary bulk button was added and then removed on request.
- Current UI: only per-row toggle remains.
- File cleaned accordingly:
  - src/features/webamp-skins/WinampSkinsStuffPicksPage.tsx

## 5) Firebase / Functions / Deploy Handling

- Added functions predeploy build to avoid stale `functions/lib` output during deploy:
  - `npm --prefix "$RESOURCE_DIR" run build`
  - File: firebase.json

- `health` function set to private invoker to avoid IAM public-binding failures in this project policy context.
  - File: functions/src/index.ts

- Tried callable-based `setWebampSkinStaffPick` path, but deployment/invoker IAM policy prevented reliable create/use.
- Final decision in this session:
  - Removed backend callable dependency for staff-pick toggles.
  - Staff-pick updates now use Firestore client writes directly from web page.
  - `functions/src/index.ts` currently keeps only `health`.

## 6) Additional Notes for Next AI

- Firestore rules currently require updates to preserve:
  - `storagePath` matching `media/public/webamp-skins/.*`
  - `enabled == true`
- Any bulk/migration write must account for rule constraints per document.
- `setMissingWebampSkinStaffPicksToTrue()` exists in repository but is currently unused by UI (safe to remove later if desired).
- Route name intentionally uses user-requested spelling: `/winamp-skins-stuff-picks`.

## 7) Files touched in this session (high-signal)

- src/App.tsx
- src/lib/firebase.ts
- src/features/home/HomePage.tsx
- src/features/home/components/BrandLogoExperience.tsx
- src/features/home/components/SocialLinks.tsx
- src/features/home/components/StrangeOsDialog.tsx
- src/features/home/components/DoomDialog.tsx
- src/features/home/components/MinesweeperDialog.tsx
- src/features/home/components/JspaintDialog.tsx
- src/features/home/components/WebampSkinDialog.tsx
- src/features/webamp-skins/webamp-skin-repository.ts
- src/features/webamp-skins/WinampSkinsStuffPicksPage.tsx
- functions/src/index.ts
- firebase.json

---

If continuing from this point, priority checks:
1. Verify `/winamp-skins-stuff-picks` per-row toggles persist correctly with current rules.
2. Verify Winamp dialog filter toggle updates list without remount side effects.
3. Decide whether to remove unused `setMissingWebampSkinStaffPicksToTrue()` utility.
