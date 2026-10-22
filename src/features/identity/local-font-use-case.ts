// Private to this browser's localhost catalog, never written to the public catalog.
export const LOCAL_FONT_USE_CASE = "Tattoo";
const STORAGE_KEY = "identity-local-tattoo-fonts-v1";

export function canUseLocalFontUseCase() {
  return typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

export function hasLocalFontUseCase(id: string) {
  if (!canUseLocalFontUseCase()) return false;
  try {
    const ids: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(ids) && ids.includes(id);
  } catch { return false; }
}

export function setLocalFontUseCase(id: string, enabled: boolean) {
  if (!canUseLocalFontUseCase()) throw new Error("Localhost only");
  let ids: unknown;
  try { ids = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { ids = []; }
  const next = new Set<string>(Array.isArray(ids) ? ids.filter((value): value is string => typeof value === "string") : []);
  if (enabled) next.add(id); else next.delete(id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
}
