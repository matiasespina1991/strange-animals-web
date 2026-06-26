const doomBundlePublicPath = '/media/games/doom-js-dos/doom.jsdos';

export function getDoomBundleUrl() {
  return new URL(doomBundlePublicPath, window.location.origin).toString();
}
