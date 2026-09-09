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

export interface BasemapFile {
  path: string;
  bytes: number;
  featureCount: number;
}

export interface BasemapManifest {
  source: string;
  ref: string;
  license: string;
  files: Record<string, BasemapFile>;
}

/** Vendored glyph ranges for the territory labels. */
export interface FontsManifest {
  source: string;
  ref: string;
  license: string;
  /** Font-stack name the style refers to (also the directory name). */
  stack: string;
  /** MapLibre glyph URL template relative to the site root. */
  template: string;
  ranges: string[];
  bytes: number;
}

/** Build-time index of every NAME value and the snapshot years it appears in. */
export interface NameIndexManifest {
  path: string;
  bytes: number;
  count: number;
}

/** Simplified, NAME/SUBJECTO-only copies of every snapshot for point lookups. */
export interface LookupManifest {
  tool: string;
  tolerance: string;
  bytes: number;
  files: Array<{ year: number; path: string; bytes: number }>;
}

export interface Manifest {
  /** Absent in manifests produced before the basemap was vendored. */
  basemap?: BasemapManifest;
  /** Absent in manifests produced before the glyphs were vendored. */
  fonts?: FontsManifest;
  /** Absent in manifests produced before the name index existed. */
  nameIndex?: NameIndexManifest;
  /** Absent in manifests produced before the lookup set existed. */
  lookup?: LookupManifest;
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
