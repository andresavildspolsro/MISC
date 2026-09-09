/**
 * Minimal point-in-polygon test for locating which dataset features contain an
 * event's coordinates. Pure geometry lookup — it draws nothing.
 */

type Ring = number[][];

/** Even-odd ray casting; handles holes by parity across all rings. */
function ringsContain(rings: Ring[], lon: number, lat: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const crosses =
        yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
  }
  return inside;
}

export function featureContains(
  feature: GeoJSON.Feature,
  lon: number,
  lat: number,
): boolean {
  const geometry = feature.geometry;
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    return ringsContain(geometry.coordinates as Ring[], lon, lat);
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as Ring[][]).some((polygon) =>
      ringsContain(polygon, lon, lat),
    );
  }
  return false;
}

export type Bbox = [[number, number], [number, number]];

/** Bounding box of a ring list as [[west, south], [east, north]]. */
export function ringsBbox(rings: Ring[]): Bbox {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < west) west = x;
      if (x > east) east = x;
      if (y < south) south = y;
      if (y > north) north = y;
    }
  }
  return [
    [west, south],
    [east, north],
  ];
}
