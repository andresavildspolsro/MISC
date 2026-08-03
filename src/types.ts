/** Shapes of the build-time manifest and of the upstream GeoJSON. */

export interface ManifestSnapshot {
  /** Negative for BC. Parsed from the upstream filename, never synthesised. */
  year: number;
  filename: string;
  /** Path relative to the site root, e.g. `data/world_1650.geojson`. */
  path: string;
  featureCount: number;
  bytes: number;
  propertyKeys: string[];
  borderPrecisions: Array<number | string>;
}

export interface Manifest {
  generatedFrom: {
    repository: string;
    commit: string;
    license: string;
  };
  simplified: false | { tool: string; tolerance: string };
  snapshots: ManifestSnapshot[];
}

/** Property bags are heterogeneous across files, so nothing here is assumed. */
export type FeatureProperties = Record<string, unknown>;

export interface SnapshotFeature extends GeoJSON.Feature {
  id?: number;
  properties: FeatureProperties;
}

export interface SnapshotCollection extends GeoJSON.FeatureCollection {
  features: SnapshotFeature[];
}
