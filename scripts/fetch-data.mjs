#!/usr/bin/env node
/**
 * Build-time data pipeline for the historical basemaps dataset.
 *
 * Downloads the upstream `aourednik/historical-basemaps` repository at a PINNED
 * commit, copies every `geojson/world_*.geojson` snapshot into `public/data/`,
 * and generates `public/data/manifest.json` describing the years that actually
 * exist on disk.
 *
 * Nothing here invents, interpolates or edits geometry. Snapshot years are
 * parsed from upstream filenames only; a file that does not parse is skipped
 * loudly rather than guessed at.
 *
 * Usage:
 *   node scripts/fetch-data.mjs                 # download (cached) + manifest
 *   node scripts/fetch-data.mjs --force         # ignore the cache, re-download
 *   node scripts/fetch-data.mjs --from <dir>    # use a local checkout instead
 *   node scripts/fetch-data.mjs --simplify      # mapshaper pass (see README)
 *   node scripts/fetch-data.mjs --simplify --simplify-tolerance 8%
 */

import { execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ config */

/**
 * Pinned upstream commit. Bump this (and only this) to adopt a newer version of
 * the dataset — see "Updating the dataset" in the README.
 */
export const UPSTREAM = {
  owner: 'aourednik',
  repo: 'historical-basemaps',
  /** aourednik/historical-basemaps @ 2026-01-26 "chore: auto-update index.json" */
  commit: '62d8f1a03a71f2d3ff17f2d166f7553f256bce68',
  license: 'GPL-3.0-or-later',
};

/**
 * Coastlines for the basemap. Natural Earth is public domain, so it can be
 * vendored and served from this site — no tile provider, no API key, nothing
 * that can start demanding one later.
 *
 * Two resolutions ship: 110m is tiny and loads with the page, 50m is fetched
 * only once the user zooms in far enough to need it.
 */
export const BASEMAP = {
  owner: 'nvkelso',
  repo: 'natural-earth-vector',
  /** Pinned release tag, for the same reason the border data is pinned. */
  ref: 'v5.1.2',
  license: 'Public domain (Natural Earth)',
  files: ['ne_110m_land', 'ne_110m_lakes', 'ne_50m_land', 'ne_50m_lakes'],
};

/**
 * Glyphs for the territory labels drawn on the map. MapLibre renders text from
 * pre-rasterised SDF glyph ranges, which are vendored here from the MapLibre
 * demo-tiles repository at a pinned commit and served from this site — the
 * same reasoning as the coastlines: no third-party font server at runtime.
 * Noto Sans is licensed under the SIL Open Font License 1.1.
 */
export const FONTS = {
  owner: 'maplibre',
  repo: 'demotiles',
  /** maplibre/demotiles @ gh-pages, pinned. */
  ref: '601ae60796ceceda2cbd2ed3d2ea92d17a84be4b',
  /** Directory name upstream (with spaces) and the stack name the style uses. */
  upstreamStack: 'Noto Sans Regular',
  stack: 'NotoSans',
  license: 'SIL Open Font License 1.1 (Noto Sans)',
  /** Unicode ranges to vendor: Latin, Latin Extended, IPA, Greek. */
  ranges: ['0-255', '256-511', '512-767', '768-1023'],
};

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT_DIR = path.join(ROOT, 'public', 'data');
const BASEMAP_DIR = path.join(OUT_DIR, 'basemap');
const FONTS_DIR = path.join(OUT_DIR, 'fonts');
const LOOKUP_DIR = path.join(OUT_DIR, 'lookup');

/**
 * The "history of a place" lookup set: every snapshot again, but heavily
 * simplified and stripped to NAME and SUBJECTO, so that all 53 can be loaded
 * at once (~5 MB, ~1.5 MB compressed) to answer "who held this point in
 * every year". Never drawn — the map always shows the full geometry — and
 * the UI says the answer comes from a simplified copy.
 */
const LOOKUP_TOLERANCE = '3%';
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache', 'historical-basemaps');

/** Default mapshaper tolerance. Conservative: visually lossless at world scale. */
const DEFAULT_SIMPLIFY_TOLERANCE = '5%';

/* ------------------------------------------------------------------- utils */

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const flagValue = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const log = (...args) => console.log('[data]', ...args);
const warn = (...args) => console.warn('[data] WARNING:', ...args);

function fail(message) {
  console.error(`[data] ERROR: ${message}`);
  process.exit(1);
}

/**
 * Parses a snapshot year out of an upstream filename.
 * `world_1650.geojson` -> 1650, `world_bc2000.geojson` -> -2000.
 * Returns null when the name does not match, so callers can skip rather than
 * guess. There is deliberately no fallback heuristic.
 */
export function parseYearFromFilename(filename) {
  const match = /^world_(bc)?(\d+)\.geojson$/i.exec(filename);
  if (!match) return null;
  const magnitude = Number(match[2]);
  if (!Number.isFinite(magnitude)) return null;
  return match[1] ? -magnitude : magnitude;
}

/* ---------------------------------------------------------------- download */

async function downloadUpstream({ force }) {
  const stamp = path.join(CACHE_DIR, `${UPSTREAM.commit}.ok`);
  const extractDir = path.join(CACHE_DIR, UPSTREAM.commit);

  if (!force) {
    try {
      await fs.access(stamp);
      log(`using cached download of ${UPSTREAM.commit.slice(0, 8)}`);
      return extractDir;
    } catch {
      /* not cached yet */
    }
  }

  await fs.rm(extractDir, { recursive: true, force: true });
  await fs.mkdir(extractDir, { recursive: true });

  const url = `https://codeload.github.com/${UPSTREAM.owner}/${UPSTREAM.repo}/tar.gz/${UPSTREAM.commit}`;
  log(`downloading ${url}`);

  const response = await fetch(url, {
    headers: { 'user-agent': 'historical-europe-map build script' },
  });
  if (!response.ok || !response.body) {
    fail(`download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const tarball = path.join(os.tmpdir(), `historical-basemaps-${UPSTREAM.commit}.tar.gz`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(tarball));

  // --strip-components=1 drops the `<repo>-<sha>/` wrapper directory.
  execFileSync('tar', ['-xzf', tarball, '-C', extractDir, '--strip-components=1'], {
    stdio: 'inherit',
  });
  await fs.rm(tarball, { force: true });

  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(stamp, new Date().toISOString());
  return extractDir;
}

/* -------------------------------------------------------------- simplify */

function simplify(inputFile, outputFile, tolerance) {
  // `mapshaper` is an optional devDependency; only required with --simplify.
  const bin = path.join(ROOT, 'node_modules', '.bin', 'mapshaper');
  execFileSync(
    bin,
    [
      inputFile,
      '-simplify',
      tolerance,
      'keep-shapes', // never let a small territory vanish entirely
      // Spherical simplification is mapshaper's default for lat/lon input,
      // which is what these files are — no `planar` flag wanted here.
      '-o',
      'format=geojson',
      'precision=0.0001',
      outputFile,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

/* ---------------------------------------------------------------- lookup */

function buildLookup(inputFile, outputFile) {
  const bin = path.join(ROOT, 'node_modules', '.bin', 'mapshaper');
  execFileSync(
    bin,
    [
      inputFile,
      '-simplify',
      LOOKUP_TOLERANCE,
      'keep-shapes',
      '-filter-fields',
      'NAME,SUBJECTO',
      '-o',
      'format=geojson',
      'precision=0.01',
      outputFile,
    ],
    // mapshaper reports unrepairable self-intersections on most files; for a
    // point-in-polygon lookup they are harmless and would only spam the log.
    { stdio: ['ignore', 'ignore', 'ignore'] },
  );
}

/* --------------------------------------------------------------- basemap */

async function downloadBasemap() {
  await fs.mkdir(BASEMAP_DIR, { recursive: true });
  const written = {};

  for (const name of BASEMAP.files) {
    const url =
      `https://raw.githubusercontent.com/${BASEMAP.owner}/${BASEMAP.repo}/` +
      `${BASEMAP.ref}/geojson/${name}.geojson`;

    const response = await fetch(url, {
      headers: { 'user-agent': 'historical-world-map build script' },
    });
    if (!response.ok) {
      fail(`basemap download failed for ${name}: HTTP ${response.status}`);
    }
    const body = await response.text();

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (error) {
      return fail(`${name}.geojson is not valid JSON: ${error.message}`);
    }
    if (parsed?.type !== 'FeatureCollection') {
      return fail(`${name}.geojson is not a GeoJSON FeatureCollection`);
    }

    await fs.writeFile(path.join(BASEMAP_DIR, `${name}.geojson`), body);
    written[name] = {
      path: `data/basemap/${name}.geojson`,
      bytes: Buffer.byteLength(body),
      featureCount: parsed.features?.length ?? 0,
    };
    log(`basemap ${name}: ${(Buffer.byteLength(body) / 1024).toFixed(0)} kB`);
  }

  return {
    source: `https://github.com/${BASEMAP.owner}/${BASEMAP.repo}`,
    ref: BASEMAP.ref,
    license: BASEMAP.license,
    files: written,
  };
}

/* ----------------------------------------------------------------- fonts */

async function downloadFonts() {
  const dir = path.join(FONTS_DIR, FONTS.stack);
  await fs.mkdir(dir, { recursive: true });
  const cacheDir = path.join(CACHE_DIR, 'fonts', FONTS.ref, FONTS.stack);
  await fs.mkdir(cacheDir, { recursive: true });
  let bytes = 0;

  for (const range of FONTS.ranges) {
    const cached = path.join(cacheDir, `${range}.pbf`);
    let body;
    try {
      body = await fs.readFile(cached);
    } catch {
      const url =
        `https://raw.githubusercontent.com/${FONTS.owner}/${FONTS.repo}/${FONTS.ref}/font/` +
        `${encodeURIComponent(FONTS.upstreamStack)}/${range}.pbf`;
      const response = await fetch(url, {
        headers: { 'user-agent': 'historical-world-map build script' },
      });
      if (!response.ok) {
        fail(`glyph download failed for ${FONTS.upstreamStack} ${range}: HTTP ${response.status}`);
      }
      body = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(cached, body);
    }
    await fs.writeFile(path.join(dir, `${range}.pbf`), body);
    bytes += body.length;
  }
  log(`fonts ${FONTS.stack}: ${FONTS.ranges.length} ranges, ${(bytes / 1024).toFixed(0)} kB`);

  return {
    source: `https://github.com/${FONTS.owner}/${FONTS.repo}`,
    ref: FONTS.ref,
    license: FONTS.license,
    stack: FONTS.stack,
    /** MapLibre glyph URL template, relative to the site root. */
    template: 'data/fonts/{fontstack}/{range}.pbf',
    ranges: FONTS.ranges,
    bytes,
  };
}

/* ------------------------------------------------------------------- main */

async function main() {
  const force = hasFlag('--force');
  const localSource = flagValue('--from', null);
  const doSimplify = hasFlag('--simplify');
  const tolerance = flagValue('--simplify-tolerance', DEFAULT_SIMPLIFY_TOLERANCE);

  const sourceRoot = localSource
    ? path.resolve(localSource)
    : await downloadUpstream({ force });

  const geojsonDir = path.join(sourceRoot, 'geojson');
  let entries;
  try {
    entries = await fs.readdir(geojsonDir);
  } catch {
    return fail(`no geojson/ directory in ${sourceRoot}`);
  }

  // Verify the license we are about to comply with is still the one we expect.
  let licenseText = '';
  try {
    licenseText = await fs.readFile(path.join(sourceRoot, 'LICENSE'), 'utf8');
  } catch {
    warn('upstream LICENSE file not found — check attribution before deploying');
  }
  if (licenseText && !/GNU GENERAL PUBLIC LICENSE\s*\n\s*Version 3/i.test(licenseText)) {
    warn(
      'upstream LICENSE is no longer GPL v3. Re-verify the footer attribution ' +
        'in src/strings.ts before shipping.',
    );
  }

  const snapshotFiles = entries
    .filter((name) => /^world_.*\.geojson$/i.test(name))
    .sort();
  if (snapshotFiles.length === 0) fail('no world_*.geojson files found upstream');

  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const snapshots = [];
  /** NAME -> set of snapshot years the name appears in (for search). */
  const namesToYears = new Map();
  const lookupFiles = [];

  for (const filename of snapshotFiles) {
    const year = parseYearFromFilename(filename);
    if (year === null) {
      warn(`skipping ${filename}: no year can be parsed from the filename`);
      continue;
    }

    const source = path.join(geojsonDir, filename);
    const destination = path.join(OUT_DIR, filename);

    if (doSimplify) {
      simplify(source, destination, tolerance);
    } else {
      await fs.copyFile(source, destination);
    }

    const raw = await fs.readFile(destination, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      fail(`${filename} is not valid JSON: ${error.message}`);
    }

    await fs.mkdir(LOOKUP_DIR, { recursive: true });
    const lookupFile = path.join(LOOKUP_DIR, filename);
    buildLookup(destination, lookupFile);
    lookupFiles.push({
      year,
      path: `data/lookup/${filename}`,
      bytes: (await fs.stat(lookupFile)).size,
    });
    if (parsed?.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
      fail(`${filename} is not a GeoJSON FeatureCollection`);
    }

    // Collect the property keys actually present, so the UI can label the ones
    // it knows about and still render the rest verbatim.
    const propertyKeys = new Set();
    const borderPrecisions = new Set();
    for (const feature of parsed.features) {
      for (const key of Object.keys(feature.properties ?? {})) propertyKeys.add(key);
      const precision = feature.properties?.BORDERPRECISION;
      if (precision !== null && precision !== undefined) borderPrecisions.add(precision);
      // Verbatim NAME values only — trimmed, never re-spelled — so the search
      // index can only ever point at names the dataset actually contains.
      const name = feature.properties?.NAME;
      if (typeof name === 'string' && name.trim() !== '') {
        const key = name.trim();
        if (!namesToYears.has(key)) namesToYears.set(key, new Set());
        namesToYears.get(key).add(year);
      }
    }

    snapshots.push({
      year,
      filename,
      path: `data/${filename}`,
      featureCount: parsed.features.length,
      bytes: Buffer.byteLength(raw),
      propertyKeys: [...propertyKeys].sort(),
      borderPrecisions: [...borderPrecisions].sort(),
    });
  }

  snapshots.sort((a, b) => a.year - b.year);

  const duplicates = snapshots
    .map((s) => s.year)
    .filter((year, index, all) => all.indexOf(year) !== index);
  if (duplicates.length) fail(`duplicate snapshot years: ${duplicates.join(', ')}`);

  const basemap = await downloadBasemap();
  const fonts = await downloadFonts();

  // Search index: every NAME in the dataset with the years it appears in.
  const names = {};
  for (const key of [...namesToYears.keys()].sort((a, b) => a.localeCompare(b, 'en'))) {
    names[key] = [...namesToYears.get(key)].sort((a, b) => a - b);
  }
  const namesJson = JSON.stringify({ generatedFrom: UPSTREAM.commit, names });
  await fs.writeFile(path.join(OUT_DIR, 'names.json'), `${namesJson}\n`);
  const nameIndex = {
    path: 'data/names.json',
    bytes: Buffer.byteLength(namesJson),
    count: namesToYears.size,
  };
  log(`name index: ${nameIndex.count} names, ${(nameIndex.bytes / 1024).toFixed(0)} kB`);

  lookupFiles.sort((a, b) => a.year - b.year);
  const lookupBytes = lookupFiles.reduce((sum, file) => sum + file.bytes, 0);
  log(`lookup set: ${lookupFiles.length} files, ${(lookupBytes / 1e6).toFixed(1)} MB at ${LOOKUP_TOLERANCE}`);

  const manifest = {
    basemap,
    fonts,
    nameIndex,
    lookup: { tool: 'mapshaper', tolerance: LOOKUP_TOLERANCE, bytes: lookupBytes, files: lookupFiles },
    generatedFrom: {
      repository: `https://github.com/${UPSTREAM.owner}/${UPSTREAM.repo}`,
      commit: UPSTREAM.commit,
      license: UPSTREAM.license,
    },
    simplified: doSimplify ? { tool: 'mapshaper', tolerance } : false,
    snapshots,
  };

  await fs.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const totalBytes = snapshots.reduce((sum, s) => sum + s.bytes, 0);
  log(
    `wrote ${snapshots.length} snapshots (${(totalBytes / 1e6).toFixed(1)} MB)` +
      `${doSimplify ? ` simplified at ${tolerance}` : ''}`,
  );
  log(`years ${snapshots[0].year} … ${snapshots[snapshots.length - 1].year}`);
}

main().catch((error) => fail(error.stack ?? String(error)));
