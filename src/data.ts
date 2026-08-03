import { slotFor } from './colors';
import type { Manifest, ManifestSnapshot, SnapshotCollection } from './types';

/**
 * Loading of the build-time manifest and of individual snapshot files.
 *
 * Everything is served as a static asset from this site; nothing is fetched
 * from GitHub at runtime. Parsed snapshots are cached so stepping back and
 * forth along the timeline is instant, with adjacent years prefetched.
 */

/** Parsed snapshots held in memory. The largest file is ~4 MB of JSON. */
const MAX_CACHED_SNAPSHOTS = 5;

const cache = new Map<string, SnapshotCollection>();
const inFlight = new Map<string, Promise<SnapshotCollection>>();

/** Rendering metadata added to each feature. Prefixed so it cannot collide. */
export const SLOT_KEY = '__slot';
export const PRECISION_KEY = '__precision';

/** Property keys this module adds; the detail panel must not display them. */
export const DERIVED_KEYS: ReadonlySet<string> = new Set([SLOT_KEY, PRECISION_KEY]);

export async function loadManifest(): Promise<Manifest> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/manifest.json`);
  if (!response.ok) {
    throw new Error(`manifest.json: HTTP ${response.status}`);
  }
  const manifest = (await response.json()) as Manifest;
  if (!Array.isArray(manifest.snapshots) || manifest.snapshots.length === 0) {
    throw new Error('manifest.json contains no snapshots');
  }
  manifest.snapshots.sort((a, b) => a.year - b.year);
  return manifest;
}

/**
 * Reads BORDERPRECISION as a number when possible.
 *
 * The value is an ordinal 1–3 upstream but is occasionally absent, and a few
 * files store it as a string. Anything that is not a finite number becomes
 * `null`, which the UI reports as "not in dataset" rather than guessing.
 */
function normalisePrecision(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Adds rendering metadata in place: a stable feature id for hover state, a
 * palette slot, and a normalised border precision. No geometry is touched and
 * no dataset property is altered or removed.
 */
function prepare(collection: SnapshotCollection): SnapshotCollection {
  collection.features.forEach((feature, index) => {
    feature.id = index;
    const properties = (feature.properties ??= {});
    properties[SLOT_KEY] = slotFor(properties);
    properties[PRECISION_KEY] = normalisePrecision(properties.BORDERPRECISION);
  });
  return collection;
}

function remember(path: string, collection: SnapshotCollection): void {
  cache.set(path, collection);
  while (cache.size > MAX_CACHED_SNAPSHOTS) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function isCached(snapshot: ManifestSnapshot): boolean {
  return cache.has(snapshot.path);
}

export function loadSnapshot(snapshot: ManifestSnapshot): Promise<SnapshotCollection> {
  const cached = cache.get(snapshot.path);
  if (cached) {
    // Refresh recency so the LRU keeps what the user is actually using.
    cache.delete(snapshot.path);
    cache.set(snapshot.path, cached);
    return Promise.resolve(cached);
  }

  const pending = inFlight.get(snapshot.path);
  if (pending) return pending;

  const request = fetch(`${import.meta.env.BASE_URL}${snapshot.path}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`${snapshot.filename}: HTTP ${response.status}`);
      }
      const collection = (await response.json()) as SnapshotCollection;
      if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
        throw new Error(`${snapshot.filename} is not a GeoJSON FeatureCollection`);
      }
      const prepared = prepare(collection);
      remember(snapshot.path, prepared);
      return prepared;
    })
    .finally(() => {
      inFlight.delete(snapshot.path);
    });

  inFlight.set(snapshot.path, request);
  return request;
}

/** Warms the cache for a neighbouring year. Failures are deliberately silent. */
export function prefetchSnapshot(snapshot: ManifestSnapshot | undefined): void {
  if (!snapshot || cache.has(snapshot.path) || inFlight.has(snapshot.path)) return;
  loadSnapshot(snapshot).catch(() => {
    /* the user has not asked for this year yet; surface nothing */
  });
}
