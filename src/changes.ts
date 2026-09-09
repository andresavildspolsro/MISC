import { ringsBbox, type Bbox, featureContains } from './geo';
import { territoryLabels } from './labels';
import type { SnapshotCollection, SnapshotFeature } from './types';

/**
 * "What changed": which territories of the shown snapshot are held by a
 * different power than the same place was in the previous snapshot.
 *
 * The comparison is purely between two dataset records: for each named
 * territory of the current snapshot, the point where its label sits is looked
 * up in the previous snapshot, and the two holders — SUBJECTO, falling back
 * to NAME — are compared verbatim. A change of spelling upstream counts as a
 * change; a real transfer the dataset does not record does not. The UI says
 * so: this is a diff of records, not a list of historical events.
 */

/** Holder key of a feature: who the dataset says the place belongs to. */
function holderOf(feature: SnapshotFeature): string {
  const properties = feature.properties ?? {};
  for (const key of ['SUBJECTO', 'NAME']) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim().toLowerCase();
  }
  return '';
}

const bboxCache = new WeakMap<SnapshotCollection, Array<Bbox | null>>();

/** Bounding boxes of every feature, computed once per collection. */
export function featureBboxes(collection: SnapshotCollection): Array<Bbox | null> {
  const cached = bboxCache.get(collection);
  if (cached) return cached;
  const boxes = collection.features.map((feature) => {
    const geometry = feature.geometry;
    if (!geometry) return null;
    if (geometry.type === 'Polygon') return ringsBbox(geometry.coordinates as number[][][]);
    if (geometry.type === 'MultiPolygon') {
      return ringsBbox((geometry.coordinates as number[][][][]).flat());
    }
    return null;
  });
  bboxCache.set(collection, boxes);
  return boxes;
}

/** Index of the feature containing the point, or -1. Bbox-prefiltered. */
export function featureIndexAt(
  collection: SnapshotCollection,
  lon: number,
  lat: number,
): number {
  const boxes = featureBboxes(collection);
  for (let i = 0; i < collection.features.length; i += 1) {
    const box = boxes[i];
    if (!box) continue;
    if (lon < box[0][0] || lon > box[1][0] || lat < box[0][1] || lat > box[1][1]) continue;
    if (featureContains(collection.features[i], lon, lat)) return i;
  }
  return -1;
}

export interface ChangeSet {
  /** Feature ids (indices) of the current snapshot whose holder differs. */
  changed: number[];
  /** Named territories compared. */
  compared: number;
}

const changeCache = new WeakMap<SnapshotCollection, WeakMap<SnapshotCollection, ChangeSet>>();

export function computeChanges(
  current: SnapshotCollection,
  previous: SnapshotCollection,
): ChangeSet {
  const perPrevious = changeCache.get(current) ?? new WeakMap<SnapshotCollection, ChangeSet>();
  const cached = perPrevious.get(previous);
  if (cached) return cached;

  const changed: number[] = [];
  let compared = 0;
  for (const label of territoryLabels(current)) {
    const feature = current.features[label.index];
    const [lon, lat] = label.point;
    const before = featureIndexAt(previous, lon, lat);
    compared += 1;
    const holderNow = holderOf(feature);
    const holderBefore = before === -1 ? '' : holderOf(previous.features[before]);
    if (holderNow !== holderBefore) changed.push(label.index);
  }

  const result = { changed, compared };
  perPrevious.set(previous, result);
  changeCache.set(current, perPrevious);
  return result;
}
