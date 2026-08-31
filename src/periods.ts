import type { HistEvent } from './events';
import type { LocaleCode } from './strings';

/**
 * Chapters: curated, bounded historical periods (a war, an age of discovery)
 * with their own milestone axis.
 *
 * A chapter is navigation and framing, not new geography. Its milestones are
 * ordinary entries of the events layer (same sourcing rules, same popups), its
 * map view is a bounding box, and the borders shown while inside it are — as
 * everywhere on this site — real dataset snapshots. The chapter UI carries a
 * permanent "Borders: <year> snapshot" badge precisely because most chapters
 * span few snapshots (the Thirty Years' War contains none at all), and the
 * milestone axis is linear in real time, unlike the ordinal main slider.
 */

export type PeriodCategory = 'war' | 'discovery' | 'revolution' | 'era';

/**
 * One side of a chapter's conflict, for tinting territories.
 *
 * `territories` lists dataset NAME values verbatim (including the dataset's
 * own spellings — "Kingfom of Italy", "Scottland"), across every snapshot the
 * chapter can show. Matching is exact: a participant the shown snapshot does
 * not name simply stays untinted, which is the honest outcome — the tint
 * never outlines a shape the dataset does not draw.
 */
export interface PeriodSide {
  name: Record<LocaleCode, string>;
  territories: string[];
}

export interface Period {
  id: string;
  /** Inclusive year range; negative = BC. */
  start: number;
  end: number;
  category: PeriodCategory;
  /** Map view for the chapter: [[west, south], [east, north]]. */
  bounds: [[number, number], [number, number]];
  name: Record<LocaleCode, string>;
  description: Record<LocaleCode, string>;
  /** Event ids from the events layer, the chapter's milestones. */
  milestones: string[];
  /** Optional conflict sides; omitted when the dataset cannot express them. */
  sides?: PeriodSide[];
  source: { label: string; url: string };
}

/** Compact constructor mirroring E() in src/events.ts. */
export function P(
  id: string,
  start: number,
  end: number,
  category: PeriodCategory,
  bounds: [[number, number], [number, number]],
  names: [string, string, string],
  descriptions: [string, string, string],
  milestones: string[],
  wikipediaUrl: string,
  sides?: Array<{ names: [string, string, string]; territories: string[] }>,
): Period {
  const article = decodeURIComponent(wikipediaUrl.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  return {
    id,
    start,
    end,
    category,
    bounds,
    name: { cs: names[0], en: names[1], es: names[2] },
    description: { cs: descriptions[0], en: descriptions[1], es: descriptions[2] },
    milestones,
    sides: sides?.map((side) => ({
      name: { cs: side.names[0], en: side.names[1], es: side.names[2] },
      territories: side.territories,
    })),
    source: { label: article ? `Wikipedia: ${article}` : 'Wikipedia', url: wikipediaUrl },
  };
}

/**
 * Resolves a chapter's milestone ids to events, sorted by year. Broken
 * references and milestones outside the chapter's range are reported on the
 * console and dropped — a chapter must not smuggle in an event its own frame
 * says does not belong.
 */
export function resolveMilestones(
  period: Period,
  eventsById: Map<string, HistEvent>,
): HistEvent[] {
  const resolved: HistEvent[] = [];
  for (const id of period.milestones) {
    const event = eventsById.get(id);
    if (!event) {
      console.warn(`chapter "${period.id}" references unknown event "${id}"; skipped`);
      continue;
    }
    if (event.year < period.start || event.year > period.end) {
      console.warn(
        `chapter "${period.id}" (${period.start}–${period.end}) references out-of-range event "${id}" (${event.year}); skipped`,
      );
      continue;
    }
    resolved.push(event);
  }
  return resolved.sort((a, b) => a.year - b.year);
}
