import { ringsBbox, type Bbox } from './geo';
import { glossName } from './nameGlosses';
import type { LocaleCode } from './strings';
import type { SnapshotCollection } from './types';

/**
 * Name labels for the territories of a snapshot.
 *
 * Every label is the dataset's own NAME (or its curated translation, see
 * src/nameGlosses.ts) placed inside the dataset's own polygon — the site adds
 * no geography here, only a place to print what the record already says.
 *
 * Placement is the "pole of inaccessibility" of the territory's largest
 * polygon (the point furthest from any edge), which keeps a label inside a
 * crescent-shaped or ragged territory where a plain centroid would fall in
 * the sea. Overseas possessions do not pull the label around: France's label
 * sits in France, not in the Atlantic between France and Guiana.
 *
 * Territories are ranked by area into tiers. Each tier switches on at a
 * zoom level, so the world view shows only the largest powers and a zoomed-in
 * Europe shows its duchies — MapLibre's collision detection thins the rest.
 */

type Ring = number[][];

export interface TerritoryLabel {
  /** Feature index in the snapshot collection (also the feature id). */
  index: number;
  /** Verbatim dataset NAME, trimmed. */
  name: string;
  /** Pole of inaccessibility of the largest polygon: [lon, lat]. */
  point: [number, number];
  /** Bounding box of that largest polygon — a sensible frame for "fly to". */
  bbox: Bbox;
  /** Approximate area of the largest polygon in km². */
  areaKm2: number;
  /** 0 = shown at world zoom … TIER_MIN_ZOOMS.length-1 = only close up. */
  tier: number;
}

/** Zoom level at which each area tier becomes visible. */
export const TIER_MIN_ZOOMS = [0, 1.6, 2.8, 4, 5.5] as const;

/** Lower area bounds (km²) of the tiers above, largest first. */
const TIER_AREAS_KM2 = [1_000_000, 250_000, 50_000, 5_000, 0];

/** km² per square degree at the equator (WGS84 mean radius). */
const KM2_PER_DEG2 = 12_364;

const cache = new WeakMap<SnapshotCollection, TerritoryLabel[]>();

/* ----------------------------------------------------------- geometry */

/** Shoelace area of a ring in square degrees, sign dropped. */
function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(sum) / 2;
}

function ringCentroidLat(ring: Ring): number {
  let sum = 0;
  for (const [, lat] of ring) sum += lat;
  return ring.length ? sum / ring.length : 0;
}

/** Point-to-polygon distance: positive inside, negative outside. */
function signedDistance(x: number, y: number, rings: Ring[]): number {
  let inside = false;
  let minDistSq = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[j];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;

      // Squared distance from the point to segment a-b.
      let dx = bx - ax;
      let dy = by - ay;
      let px = ax;
      let py = ay;
      if (dx !== 0 || dy !== 0) {
        const t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
          px = bx;
          py = by;
        } else if (t > 0) {
          px += dx * t;
          py += dy * t;
        }
      }
      dx = x - px;
      dy = y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) minDistSq = distSq;
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(minDistSq);
}

interface Cell {
  x: number;
  y: number;
  h: number;
  d: number;
  max: number;
}

function makeCell(x: number, y: number, h: number, rings: Ring[]): Cell {
  const d = signedDistance(x, y, rings);
  return { x, y, h, d, max: d + h * Math.SQRT2 };
}

/**
 * Pole of inaccessibility (Garcia-Castellanos & Lombardo; the "polylabel"
 * algorithm): a grid search refined by a priority queue of cells, each
 * bounded by the best distance it could possibly contain.
 */
function poleOfInaccessibility(rings: Ring[], bbox: Bbox): [number, number] {
  const [[minX, minY], [maxX, maxY]] = bbox;
  const width = maxX - minX;
  const height = maxY - minY;
  const size = Math.min(width, height);
  if (size === 0) return [minX, minY];
  // Coarser than the reference implementation: this is a label anchor, not a
  // survey, and a snapshot can carry hundreds of intricate polygons.
  const precision = Math.max(size / 40, 1e-4);
  const cellSize = size;
  const h = cellSize / 2;

  const queue: Cell[] = [];
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      queue.push(makeCell(x + h, y + h, h, rings));
    }
  }

  const outer = rings[0];
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i, i += 1) {
    const f = outer[i][0] * outer[j][1] - outer[j][0] * outer[i][1];
    cx += (outer[i][0] + outer[j][0]) * f;
    cy += (outer[i][1] + outer[j][1]) * f;
    area += f * 3;
  }
  let best =
    area === 0
      ? makeCell(outer[0][0], outer[0][1], 0, rings)
      : makeCell(cx / area, cy / area, 0, rings);
  const bboxCell = makeCell(minX + width / 2, minY + height / 2, 0, rings);
  if (bboxCell.d > best.d) best = bboxCell;

  let iterations = 0;
  while (queue.length && iterations < 4000) {
    iterations += 1;
    // Pop the cell with the highest potential.
    let bestIndex = 0;
    for (let i = 1; i < queue.length; i += 1) {
      if (queue[i].max > queue[bestIndex].max) bestIndex = i;
    }
    const cell = queue[bestIndex];
    queue[bestIndex] = queue[queue.length - 1];
    queue.pop();

    if (cell.d > best.d) best = cell;
    if (cell.max - best.d <= precision) continue;

    const q = cell.h / 2;
    queue.push(makeCell(cell.x - q, cell.y - q, q, rings));
    queue.push(makeCell(cell.x + q, cell.y - q, q, rings));
    queue.push(makeCell(cell.x - q, cell.y + q, q, rings));
    queue.push(makeCell(cell.x + q, cell.y + q, q, rings));
  }
  return [best.x, best.y];
}

/** The largest polygon (outer ring + holes) of a Polygon or MultiPolygon. */
function largestPolygon(geometry: GeoJSON.Geometry | null): Ring[] | null {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.length ? (geometry.coordinates as Ring[]) : null;
  }
  if (geometry.type === 'MultiPolygon') {
    let best: Ring[] | null = null;
    let bestArea = -1;
    for (const polygon of geometry.coordinates as Ring[][]) {
      if (!polygon.length) continue;
      const area = ringArea(polygon[0]);
      if (area > bestArea) {
        bestArea = area;
        best = polygon;
      }
    }
    return best;
  }
  return null;
}

/* -------------------------------------------------------------- public */

/**
 * Computes (and caches per collection) one label record per named feature.
 * Unnamed territories get no label — there is nothing honest to print.
 */
export function territoryLabels(collection: SnapshotCollection): TerritoryLabel[] {
  const cached = cache.get(collection);
  if (cached) return cached;

  const labels: TerritoryLabel[] = [];
  collection.features.forEach((feature, index) => {
    const rawName = feature.properties?.NAME;
    if (typeof rawName !== 'string' || rawName.trim() === '') return;
    const rings = largestPolygon(feature.geometry);
    if (!rings || rings[0].length < 3) return;

    const bbox = ringsBbox([rings[0]]);
    const latRad = (ringCentroidLat(rings[0]) * Math.PI) / 180;
    const areaKm2 = ringArea(rings[0]) * KM2_PER_DEG2 * Math.max(Math.cos(latRad), 0.05);
    const tier = TIER_AREAS_KM2.findIndex((floor) => areaKm2 >= floor);

    labels.push({
      index,
      name: rawName.trim(),
      point: poleOfInaccessibility(rings, bbox),
      bbox,
      areaKm2,
      tier: tier === -1 ? TIER_AREAS_KM2.length - 1 : tier,
    });
  });

  labels.sort((a, b) => b.areaKm2 - a.areaKm2);
  cache.set(collection, labels);
  return labels;
}

/** GeoJSON points for the map's symbol layers, texts in the given language. */
export function labelsFeatureCollection(
  labels: TerritoryLabel[],
  locale: LocaleCode,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: labels.map((label, rank) => ({
      type: 'Feature',
      id: label.index,
      geometry: { type: 'Point', coordinates: label.point },
      properties: {
        label: glossName(label.name, locale) ?? label.name,
        tier: label.tier,
        rank,
      },
    })),
  };
}
