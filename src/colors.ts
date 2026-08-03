/**
 * Categorical colours for territories.
 *
 * A political map carries hundreds of distinct territories, so no palette can
 * give each one a unique, colourblind-separable hue — colours necessarily
 * repeat. Colour here is a *grouping* cue (possessions of the same power share
 * one), never the sole carrier of identity: every territory also has a visible
 * outline, a hover tooltip and a detail panel with its actual name.
 *
 * The twelve slots below are evenly spaced around the OKLCH hue circle in two
 * alternating lightness bands, ordered by the golden angle so that consecutive
 * slots differ as much as possible. Both sets pass the lightness-band, chroma,
 * CVD-separation and normal-vision checks of the data-visualisation palette
 * validator (worst adjacent CVD ΔE 11.6 light / 10.3 dark, against an ≥8
 * target; worst normal-vision ΔE 29.5 / 27.8, against a ≥15 floor). The
 * remaining sub-3:1 contrast warning is answered by the per-territory outlines
 * and the name shown on hover.
 */

export const PALETTE_LIGHT = [
  '#00cab1',
  '#9c5db0',
  '#caac2f',
  '#0086be',
  '#f8869a',
  '#329046',
  '#a5a0ff',
  '#b36400',
  '#00c7d1',
  '#ad5697',
  '#abb844',
  '#337cca',
] as const;

export const PALETTE_DARK = [
  '#00ab93',
  '#88459d',
  '#ac8c00',
  '#0071ac',
  '#da637a',
  '#007c2d',
  '#877fe6',
  '#9f4c00',
  '#00a9b3',
  '#993d84',
  '#8d9900',
  '#0c66b8',
] as const;

/** Used when a feature has neither SUBJECTO nor NAME — an absence, not a group. */
export const UNGROUPED_LIGHT = '#9a9a95';
export const UNGROUPED_DARK = '#6b6b66';

/** Slot value written onto features that have no grouping key at all. */
export const UNGROUPED_SLOT = -1;

/** FNV-1a. Stable across sessions so a power keeps its colour between years. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Picks the palette slot for a feature.
 *
 * Keyed on SUBJECTO so that possessions of the same power share a colour, with
 * NAME as the documented fallback. Returns {@link UNGROUPED_SLOT} when the
 * dataset records neither.
 */
export function slotFor(properties: Record<string, unknown>): number {
  const subject = properties.SUBJECTO;
  const name = properties.NAME;
  const key =
    typeof subject === 'string' && subject.trim() !== ''
      ? subject.trim()
      : typeof name === 'string' && name.trim() !== ''
        ? name.trim()
        : null;

  if (key === null) return UNGROUPED_SLOT;
  return hash(key.toLowerCase()) % PALETTE_LIGHT.length;
}

export function palette(dark: boolean): readonly string[] {
  return dark ? PALETTE_DARK : PALETTE_LIGHT;
}

export function ungroupedColor(dark: boolean): string {
  return dark ? UNGROUPED_DARK : UNGROUPED_LIGHT;
}
