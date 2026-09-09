import { featureIndexAt } from './changes';
import type { LookupManifest, SnapshotCollection } from './types';

/**
 * "History of a place": who the dataset records at one point in every
 * snapshot. Answered from the lookup set — simplified, NAME/SUBJECTO-only
 * copies of every snapshot produced at build time — which is loaded once, on
 * first use, with progress reported to the UI. The map itself keeps drawing
 * the full geometry; the UI says the answer comes from a simplified copy.
 */

export interface PlaceHistoryEntry {
  year: number;
  /** Verbatim NAME, or null when no territory contains the point. */
  name: string | null;
  /** Verbatim SUBJECTO when present and different from NAME. */
  subject: string | null;
}

const cache = new Map<number, SnapshotCollection>();
let loading: Promise<void> | null = null;

export function lookupLoaded(manifest: LookupManifest): boolean {
  return manifest.files.every((file) => cache.has(file.year));
}

/** Loads every lookup file (once); `onProgress` gets (done, total). */
export function loadLookup(
  manifest: LookupManifest,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (loading) return loading;
  const base = import.meta.env.BASE_URL;
  const pending = manifest.files.filter((file) => !cache.has(file.year));
  let done = manifest.files.length - pending.length;
  onProgress?.(done, manifest.files.length);

  // A handful at a time: 53 parallel requests would stall a phone.
  const queue = [...pending];
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const response = await fetch(`${base}${file.path}`);
      if (!response.ok) throw new Error(`${file.path}: HTTP ${response.status}`);
      const collection = (await response.json()) as SnapshotCollection;
      cache.set(file.year, collection);
      done += 1;
      onProgress?.(done, manifest.files.length);
    }
  };
  loading = Promise.all([worker(), worker(), worker(), worker()])
    .then(() => undefined)
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Requires the lookup set to be loaded. Years ascending. */
export function historyAt(manifest: LookupManifest, lon: number, lat: number): PlaceHistoryEntry[] {
  return manifest.files.map((file) => {
    const collection = cache.get(file.year);
    if (!collection) return { year: file.year, name: null, subject: null };
    const index = featureIndexAt(collection, lon, lat);
    if (index === -1) return { year: file.year, name: null, subject: null };
    const properties = collection.features[index].properties ?? {};
    const name = typeof properties.NAME === 'string' && properties.NAME.trim() ? properties.NAME.trim() : null;
    const subjectRaw =
      typeof properties.SUBJECTO === 'string' && properties.SUBJECTO.trim() ? properties.SUBJECTO.trim() : null;
    const subject = subjectRaw && subjectRaw !== name ? subjectRaw : null;
    return { year: file.year, name, subject };
  });
}
