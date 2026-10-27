/** Disabled families are available for local review only, never on hosted sites. */
export function visibleFontCatalog<T extends { enabled: boolean }>(fonts: T[], hostname: string) {
  const local = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
  return fonts.filter(font => local || font.enabled === true);
}
