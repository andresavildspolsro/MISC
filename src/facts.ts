import type { LocaleCode } from './strings';

/**
 * "Interesting facts" — added context, kept strictly apart from the dataset.
 *
 * This site's core rule is that it never displays anything the border dataset
 * does not contain. Facts are the one deliberate, fenced-off exception, and
 * the fence has three planks:
 *
 *  1. They render in their own card behind an explicit toggle, never inside
 *     the dataset record panel.
 *  2. The card carries a permanent "added context — not part of the dataset"
 *     label.
 *  3. Every fact is expected to cite an external source a reader can check.
 *     A fact without one renders with an "unverified" warning — and should be
 *     treated as a to-do, not a finished entry. LLM-drafted text (the initial
 *     list came from Gemini) counts as unsourced until a real reference backs
 *     it: models fabricate historical detail fluently.
 *
 * The list itself lives here, in code review's path, rather than in a fetched
 * file — changing history content should be as visible as changing logic.
 */

export interface FactSource {
  /** Human-readable name of the reference, e.g. "Wikipedia: Battle of X". */
  label: string;
  url: string;
}

export interface Fact {
  /** Stable identifier, e.g. "1416-venice-gallipoli". */
  id: string;
  /**
   * Dataset snapshot years this fact is shown on. Must be years that exist as
   * files — a fact tied to a year the slider cannot reach would never render.
   * The app warns on the console at start-up about such entries rather than
   * letting them rot silently.
   */
  years: number[];
  /** Optional territory the fact concerns; shown as a lead-in when present. */
  territory?: string;
  /** At least one language; the card falls back and says so when untranslated. */
  text: Partial<Record<LocaleCode, string>>;
  /** External reference. Optional in the type, expected in practice. */
  source?: FactSource;
}

import { FACTS } from './factsData';

export { FACTS };

export function factsForYear(year: number): Fact[] {
  return FACTS.filter((fact) => fact.years.includes(year));
}

/** Picks the best available language for a fact, noting fallback. */
export function factText(
  fact: Fact,
  locale: LocaleCode,
): { text: string; translated: boolean } {
  const exact = fact.text[locale];
  if (exact) return { text: exact, translated: true };
  const fallback = fact.text.cs ?? fact.text.en ?? fact.text.es ?? '';
  return { text: fallback, translated: false };
}
