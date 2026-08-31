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

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT_DIR = path.join(ROOT, 'public', 'data');
const BASEMAP_DIR = path.join(OUT_DIR, 'basemap');
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

  const manifest = {
    basemap,
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
