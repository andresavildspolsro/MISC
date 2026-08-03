# Historical borders of Europe

An interactive map of historical political and cultural boundaries, from deep
antiquity to 2010, with a time slider. Built on the open
[Historical Basemaps](https://github.com/aourednik/historical-basemaps) dataset
by André Ourednik and contributors.

The site is educational, so it is built around one constraint: **it never shows
anything the dataset does not contain.** No geometry is authored or adjusted
here, no year is interpolated, and a property the dataset leaves empty is
displayed as "not in dataset" rather than filled in.

---

## What the site does

- **Time slider** stepping through the 53 snapshot years that exist as files
  upstream — 123000 BC to AD 2010. The control is indexed by snapshot, so a
  year with no file simply cannot be selected. Arrow keys step; a play button
  animates; neighbouring years are prefetched.
- **Territory colouring** keyed on `SUBJECTO` (falling back to `NAME`) so that
  possessions of the same power share a colour.
- **Visible uncertainty.** `BORDERPRECISION` drives fill opacity and outline
  style: borders the dataset records as legally determined are solid, and
  approximate ones are dashed and faded.
- **Detail panel** listing every property the clicked feature carries, with the
  raw key shown next to the human label so the panel can be audited against the
  source file, plus a note naming the file the geometry came from.
- **Basemap toggle.** The modern basemap is label-free, desaturated, and starts
  hidden before AD 1000, because modern coastlines and rivers under ancient
  borders mislead.
- **Pre-1648 banner** noting that fixed national boundaries are anachronistic in
  Europe before the Peace of Westphalia.
- **Deep links.** `?year=1650` opens that snapshot. A year that is not in the
  dataset is reported as missing, never rounded to a neighbour.

## Licensing

The border dataset is licensed **GPL-3.0** (verified in the upstream repository's
`LICENSE` file, which is the GNU General Public License v3). This project is
therefore also released under **GPL-3.0-or-later**; see [`LICENSE`](LICENSE).
The data pipeline re-checks the upstream licence text on every run and warns if
it is no longer GPL v3.

Attribution appears in the site footer:

| Component | Attribution |
|---|---|
| Border data | Historical Basemaps, André Ourednik and contributors, GPL-3.0 |
| Basemap tiles | © OpenStreetMap contributors © CARTO |
| Renderer | MapLibre GL JS, BSD-3-Clause |

## Getting started

```bash
npm install
npm run dev      # downloads the dataset, then starts Vite
```

```bash
npm run build    # data + typecheck + production build into dist/
npm run preview
```

## The data pipeline

`scripts/fetch-data.mjs` is the only thing that touches the dataset.

1. Downloads `aourednik/historical-basemaps` as a tarball **at a pinned commit**
   (`UPSTREAM.commit` at the top of the script) and caches it under
   `node_modules/.cache/`.
2. Verifies the upstream `LICENSE` is still GPL v3, warning loudly if not.
3. Copies every `geojson/world_*.geojson` into `public/data/`. World files are
   **not clipped to Europe** — clipping risks introducing artefacts, so the map
   just opens framed on Europe and lets you pan.
4. Parses each snapshot year from its filename (`world_1650` → 1650,
   `world_bc2000` → −2000). A file whose name does not parse is skipped with a
   warning; there is no fallback that would guess a year.
5. Validates that each file is a GeoJSON `FeatureCollection` and that no two
   snapshots claim the same year.
6. Writes `public/data/manifest.json` — the list of years, filenames, feature
   counts, byte sizes and the property keys each file actually carries. The app
   reads only this manifest; it never fetches from GitHub at runtime.

`public/data/` is generated and git-ignored (~70 MB). Everything needed to
reproduce it is in the script.

```bash
npm run data           # download (cached) and regenerate the manifest
npm run data:force     # ignore the cache and re-download
node scripts/fetch-data.mjs --from ../historical-basemaps   # use a local checkout
```

### Updating the dataset

1. Pick the upstream commit you want and edit `UPSTREAM.commit` in
   `scripts/fetch-data.mjs`. Pinning is deliberate: an unpinned build could
   change the borders on the site without anyone noticing.
2. Run `npm run data:force`.
3. Check the script's output. New years appear on the slider automatically —
   nothing in the app hard-codes a year list. If upstream adds a property, the
   detail panel already renders it verbatim; add a friendly label for it in
   `propertyLabels` in `src/strings.ts` if you want one.
4. If the licence warning fires, resolve it before deploying: the footer text in
   `src/strings.ts` states GPL-3.0 explicitly.

The commit is shown in the site footer, so a visitor can tell exactly which
version of the dataset they are looking at.

### The simplification flag

The default build ships the geometry **exactly as published upstream**. Optional
simplification trades a small amount of geometric fidelity for load speed:

```bash
npm run build:simplified
# or: node scripts/fetch-data.mjs --simplify --simplify-tolerance 8%
```

This runs each file through [mapshaper](https://github.com/mbloch/mapshaper)
with `keep-shapes` (so no small territory disappears) at a conservative default
tolerance of `5%`, which takes the dataset from ~71.5 MB to ~8.1 MB.

Trade-offs, so the choice is made with open eyes:

- Coastlines and borders lose fine detail. At the zoom levels this map uses the
  difference is hard to see, but it is a real change to the geometry.
- Mapshaper reports a handful of self-intersections it cannot repair on some
  ancient snapshots. These are pre-existing topology quirks that simplification
  surfaces; they do not affect rendering.
- Feature counts, property names, values and nulls are untouched — only vertex
  positions change. This is verified against the unsimplified output.

The manifest records whether the data was simplified and at what tolerance, and
the footer says so on the page.

## Architecture

Vite + vanilla TypeScript, MapLibre GL JS, no framework and no server code.

| File | Responsibility |
|---|---|
| `scripts/fetch-data.mjs` | Build-time download, validation, manifest |
| `src/data.ts` | Manifest and snapshot loading, LRU cache, prefetch |
| `src/map.ts` | MapLibre style, layers, hover and selection |
| `src/timeline.ts` | Snapshot-indexed slider, ticks, playback |
| `src/panel.ts` | Detail panel; renders the property bag and nothing else |
| `src/colors.ts` | Categorical palette and the hash that assigns it |
| `src/format.ts` | BC/AD year formatting |
| `src/strings.ts` | **Every** user-facing string |
| `src/main.ts` | Wiring, basemap defaults, disclaimer, deep links |

### Adding a translation

All UI copy lives in `src/strings.ts` behind a `Strings` interface. A Czech
translation means adding a second object of that type and selecting it — no
other module needs to change. `index.html` carries no copy either; its text
nodes are filled from `strings` at start-up via `data-i18n`.

### Notes on two implementation details

**The MapLibre worker.** MapLibre v6 resolves its web worker from
`import.meta.url`, which does not survive bundling — the worker fails to start
and no GeoJSON is ever tiled, leaving a blank map with no error. `src/main.ts`
therefore passes it a URL Vite has actually emitted, via `setWorkerUrl`.

**Colour and identity.** A political map has hundreds of territories, so no
palette can give each a unique, colourblind-separable hue; colours necessarily
repeat. The twelve slots in `src/colors.ts` are OKLCH-spaced across two
lightness bands and pass CVD-separation and normal-vision checks in both light
and dark mode, but colour is only ever a grouping cue. Identity comes from the
hover tooltip and the detail panel, never from colour alone.

## Deployment

Static, zero server code. On Vercel the defaults in `vercel.json` are enough:
`npm run build` (which fetches the data first) into `dist/`. The build needs
network access to `codeload.github.com` to download the pinned dataset.

## Non-goals for v1

No morphing between snapshots, no accounts, no editing, no backend, and no
events/rulers overlay — the dataset does not contain that, and inventing it
would defeat the point.
