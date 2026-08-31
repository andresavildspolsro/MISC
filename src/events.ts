import type { LocaleCode } from './strings';

/**
 * The events layer: dated historical events shown as clickable points.
 *
 * Like the facts, events are added context under the same fence: their own
 * layer behind a toggle, a permanent "not part of the border dataset" label,
 * and a checkable source on every entry. Coverage follows the conventional
 * Czech upper-secondary (gymnázium/maturita) canon — the national RVP G
 * deliberately prescribes no date list, so the canon is the curated basis and
 * every date stands on its cited reference, not on the curriculum's authority.
 *
 * Two honesty rules specific to events:
 *
 *  - Point locations are approximate by nature (a battle is not a point) and
 *    the layer's disclaimer says so.
 *  - An event never appears on a map older than itself. Each event renders on
 *    the FIRST snapshot at or after its year — the same anti-anachronism rule
 *    the facts use — and jumping to an event says which snapshot the borders
 *    come from.
 */

export interface HistEvent {
  id: string;
  /** Exact event year (negative = BC). Shown verbatim in the popup. */
  year: number;
  lat: number;
  lon: number;
  name: Record<LocaleCode, string>;
  description: Record<LocaleCode, string>;
  source: { label: string; url: string };
}

/** Compact constructor keeping the data file readable. */
export function E(
  id: string,
  year: number,
  lat: number,
  lon: number,
  names: [string, string, string],
  descriptions: [string, string, string],
  wikipediaUrl: string,
): HistEvent {
  const article = decodeURIComponent(wikipediaUrl.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  return {
    id,
    year,
    lat,
    lon,
    name: { cs: names[0], en: names[1], es: names[2] },
    description: { cs: descriptions[0], en: descriptions[1], es: descriptions[2] },
    source: { label: article ? `Wikipedia: ${article}` : 'Wikipedia', url: wikipediaUrl },
  };
}

/**
 * Maps each event to its snapshot: the first snapshot year at or after the
 * event. Events later than the newest snapshot are reported and dropped —
 * there is no map they could honestly appear on.
 */
export function assignEventsToSnapshots(
  events: HistEvent[],
  snapshotYears: number[],
): Map<number, HistEvent[]> {
  const sorted = [...snapshotYears].sort((a, b) => a - b);
  const bySnapshot = new Map<number, HistEvent[]>();

  for (const event of events) {
    const snapshot = sorted.find((year) => year >= event.year);
    if (snapshot === undefined) {
      console.warn(`event "${event.id}" (${event.year}) is later than every snapshot; skipped`);
      continue;
    }
    const bucket = bySnapshot.get(snapshot);
    if (bucket) bucket.push(event);
    else bySnapshot.set(snapshot, [event]);
  }

  for (const bucket of bySnapshot.values()) {
    bucket.sort((a, b) => a.year - b.year);
  }
  return bySnapshot;
}
