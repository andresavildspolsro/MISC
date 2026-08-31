# Historical borders of the world

An interactive map of historical political and cultural boundaries worldwide,
from deep antiquity to 2010, with a time slider. Built on the open
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
- **Detail panel on hover.** Pointing at a territory shows its full dataset
  record beside the map — every property it carries, with the raw key next to
  the human label so the panel can be audited against the source file, plus a
  note naming the file the geometry came from. A click *pins* the panel so it
  survives the pointer moving away; the panel says which of the two states it
  is in, so content changing under the cursor never looks arbitrary. Closing it
  returns to hover previewing. The hovered border glows softly — a blurred halo
  in the territory's own colour over a fainter contrast halo, so it reads as
  light on a dark map and still separates a gold territory from its warm
  neighbours on a light one.
- **World by default**, with a one-click Europe view — Europe is where the
  dataset is by far the most finely subdivided.
- **Self-hosted basemap.** Coastlines and lakes come from Natural Earth,
  vendored at build time and served from this site — no tile provider and no
  API key that can stop working. Label-free by construction, and still
  toggleable; it starts hidden before AD 1000, because modern coastlines and
  rivers under ancient borders mislead.
- **Pre-1648 banner** noting that fixed national boundaries are anachronistic in
  Europe before the Peace of Westphalia.
- **Three languages** — English, Czech and Spanish — switchable from the top bar
  without a reload. Era suffixes, number grouping and the Wikipedia host all
  follow the choice (`1650` / `1650 n. l.` / `1650 d. C.`;
  `123,000` / `123 000` / `123.000`).
- **Go to a year.** Clicking the big year readout opens a type-a-year box with
  every real snapshot year suggested. A typed year with no snapshot lands on
  the nearest one — and says so; it is a navigation request, not a claim about
  that year.
- **Deep links.** `?year=1650&lang=cs` opens that snapshot in that language. A
  year that is not in the dataset is reported as missing, never rounded to a
  neighbour — unlike the interactive jump, a shared link claims a specific year.
- **Interesting facts.** A curated list of 100 historical asides
  (`src/factsData.ts`) shown behind an explicit toggle, in their own card with
  a permanent "added context — not part of the dataset" label and a source
  link on every entry. Provenance: drafted with Gemini, then reviewed by hand —
  eight factual errors were corrected (wrong dates for the Meroe pyramids, the
  Galápagos and others; see the commit history) and legend-shaped claims are
  phrased as legends. Each fact appears on the first snapshot at or after its
  anchor date, never earlier, so nothing shows on a map that predates it; the
  real date is stated in the text. An entry without a source renders with an
  "unverified" warning; entries referencing years with no snapshot are called
  out on the console at start-up.
- **Historical events layer.** ~230 dated events (`src/eventsData.ts`) drawn
  from the conventional Czech upper-secondary (gymnázium/maturita) history
  canon — the national RVP G curriculum deliberately prescribes no date list,
  so the canon is a curated basis and every entry stands on its cited Wikipedia
  reference, not on the curriculum's authority. Events render as clickable
  points on the map (behind a toggle, with a permanent "added layer — not part
  of the border dataset; point locations are approximate" disclaimer in every
  popup) and as anchor marks on the timeline at their **exact** years, so the
  axis shows 1620, 1848 or 1989 — not just the snapshot decades. The same
  anti-anachronism rule as the facts applies: an event appears only on the
  first snapshot at or after its year, and jumping to an event's year states
  which snapshot the borders come from ("Event of 1620 — borders are from the
  1650 snapshot, the first after it"). Names and descriptions are translated
  into all three languages; events later than the newest snapshot are dropped
  with a console warning rather than shown on a map that predates them.
- **Chapters.** Curated bounded periods (`src/periodsData.ts`) — the Hundred
  Years' War, the Age of Discovery, the Cold War — opened from a strip of
  buttons under the map. A chapter frames the map on its theatre and swaps the
  main ordinal slider for a **milestone axis**: linear in real time from the
  chapter's first year to its last, with marks at the exact years of its
  milestones (which are ordinary entries of the events layer, so they keep
  their popups, sources and translations). Milestones reveal progressively as
  you step through, never ahead of the story or of the shown map. Because most
  chapters span few dataset snapshots — the Thirty Years' War contains none —
  the chapter header carries a permanent "Borders: <year> snapshot" badge, an
  explicit warning when no snapshot falls inside the range, and a "state
  before the period" button that jumps to the last snapshot preceding it.
  Deep-linkable as `?period=<id>`; milestone references are validated at
  start-up and broken or out-of-range ones are dropped with a console warning.

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
| Coastlines | Natural Earth v5.1.2, public domain |
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
3. Copies every `geojson/world_*.geojson` into `public/data/`. Files are
   **never clipped** — clipping risks introducing artefacts.
4. Parses each snapshot year from its filename (`world_1650` → 1650,
   `world_bc2000` → −2000). A file whose name does not parse is skipped with a
   warning; there is no fallback that would guess a year.
5. Validates that each file is a GeoJSON `FeatureCollection` and that no two
   snapshots claim the same year.
6. Downloads the Natural Earth coastline and lake files (110m and 50m) at a
   pinned tag into `public/data/basemap/`. 110m loads with the page (170 kB);
   50m (2.4 MB) is fetched only once the viewer zooms past the world view.
7. Writes `public/data/manifest.json` — the list of years, filenames, feature
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
   `propertyLabels` in each `src/i18n/*.ts` if you want one.
4. If the licence warning fires, resolve it before deploying: the footer text in
   `src/i18n/*.ts` states GPL-3.0 explicitly.

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

## How coverage varies

The dataset is worldwide in every snapshot, but how finely it divides the world
is not uniform. Measured across all 53 snapshots (17,521 polygons, binned into
coarse regions by area-weighted centroid):

| Region | Median territory | Polygons | Distinct names |
|---|---:|---:|---:|
| Europe | 2,914 km² | 3,307 | 444 |
| Americas | 8,741 km² | 6,215 | 1,519 |
| SE Asia + Oceania | 14,096 km² | 2,931 | 421 |
| Asia | 29,916 km² | 2,400 | 338 |
| Africa + Middle East | 125,695 km² | 1,850 | 300 |

So a typical mapped territory in Africa is some 40× larger than one in Europe.
The shapes are there; they are simply much coarser. The Americas carry the most
distinct names of any region, mostly indigenous territories in AD 500–1500.

Share of mapped **area** left unnamed (counting polygons misleads — in Europe
the unnamed ones are mostly tiny islands: in 2010 their median is 357 km² and
they are 0.2% of European area):

| | pre-1000 BC | 1000 BC – AD 500 | AD 500–1500 | AD 1500–1900 | AD 1900+ |
|---|---:|---:|---:|---:|---:|
| Europe | 66% | 55% | 25% | 2% | 1% |
| Africa + Middle East | 21% | 21% | 25% | **68%** | 7% |
| Asia | 78% | 19% | 4% | 4% | 0% |
| Americas | 76% | 14% | 24% | 18% | 0% |
| SE Asia + Oceania | 22% | 16% | 11% | 1% | 0% |

Two things worth knowing about `BORDERPRECISION`:

- **It tracks period, not regional research quality.** Value 3 is used for 0% of
  features before AD 1500 in every region, and 100% of features after 1900 in
  every region. It says "this is the modern era", not "this border is well
  established here".
- **The middle of the scale is essentially unused.** Across all 53 files: value
  1 appears 11,046 times, value 3 appears 6,468 times, value 2 appears **twice**,
  an undocumented value 0 appears 4 times, and one feature has none. In practice
  the scale is binary.

The footer states that subdivision detail varies by region and period. Regional
binning above is by centroid against rough boxes — the point is the order of
magnitude, not the third decimal.

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
| `src/format.ts` | Locale-aware year and count formatting |
| `src/strings.ts` | Active-locale accessor, `?lang=` / storage resolution |
| `src/i18n/*.ts` | **Every** user-facing string, one file per language |
| `src/main.ts` | Wiring, basemap defaults, disclaimer, deep links |

### Languages

English, Czech and Spanish ship today. The picker in the top bar switches
between them with no page reload; the choice is remembered in `localStorage`
and mirrored into `?lang=`. On first visit the language comes from `?lang=`,
then a previous choice, then the browser's `Accept-Language`, then English.

**The dataset record is never rewritten.** The NAME/SUBJECTO/PARTOF rows in
the panel always show exactly what the file contains — typos like `Scottalnd`
included. On top of that, `src/nameGlosses.ts` carries a hand-curated
translation table (~330 well-known entities, Czech and Spanish) used only for
the tooltip, the panel title and the Wikipedia search term; a glossed title
shows the original on hover, and a name not in the table renders as-is — a
missing translation beats a guessed one. MapLibre's own control tooltips
(zoom, attribution) and all `aria-label`s are localized too, and follow a
language switch live.

To add a language:

1. Copy `src/i18n/en.ts` to `src/i18n/<code>.ts` and translate the values. The
   `Strings` interface in `src/i18n/types.ts` makes a missed key a type error.
2. Set `localeTag` (drives number grouping and the `lang` attribute),
   `localeName` (written in that language, so it is recognisable to someone who
   cannot read the current UI language) and `wikipediaHost`.
3. Register it in `LOCALES` in `src/strings.ts`. Nothing else changes — the
   picker, the `?lang=` parser and the browser-preference fallback all read
   that map.

`strings` is an ES module live binding, so reassigning it in `setLocale`
updates every importer; `App.retranslate()` then repaints the chrome. Note that
year formatting is locale-dependent, so anything that prints a year must be
re-rendered — `Timeline.retranslate()` re-measures and re-packs the tick labels
because Czech and Spanish era suffixes are wider than the English ones.

`index.html` carries no copy either; its text nodes are filled from `strings` at
start-up via `data-i18n`.

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
