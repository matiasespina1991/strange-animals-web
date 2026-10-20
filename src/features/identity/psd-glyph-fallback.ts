import type { Font } from "opentype.js";

export type OutlineFallback = { family: string; font: Font };

export function outlineGlyph(font: Font, character: string, fallbacks: readonly OutlineFallback[] = []) {
  const glyph = font.charToGlyph(character);
  if (glyph.index || !character.trim()) return { glyph, fallbackFamily: undefined };
  for (const fallback of fallbacks) {
    const replacement = fallback.font.charToGlyph(character);
    if (replacement.index) return { glyph: replacement, fallbackFamily: fallback.family };
  }
  throw new Error(`Cannot outline glyph “${character}”: neither the selected font nor the default fonts contain it.`);
}
