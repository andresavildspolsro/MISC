import type { Strings } from './types';

export const en: Strings = {
  localeTag: 'en',
  localeName: 'English',
  wikipediaHost: 'en.wikipedia.org',

  languageLabel: 'Language',

  appTitle: 'Historical borders of the world',
  appTagline: 'Political and cultural boundaries, snapshot by snapshot',

  loading: 'Loading…',
  loadingSnapshot: (year) => `Loading the ${year} snapshot…`,
  loadError: (year) =>
    `The ${year} snapshot could not be loaded. No borders are shown for this year.`,
  unknownYearRequested: (requested, shown) =>
    `The dataset has no snapshot for ${requested}. Showing ${shown} instead — the nearest year is not substituted.`,

  showingYear: 'Showing',
  featureCount: (n) => `${n} territories in this snapshot`,

  yearBc: (n) => `${n} BC`,
  yearAd: (n) => `AD ${n}`,

  play: 'Play through snapshots',
  pause: 'Pause',
  previousSnapshot: 'Previous snapshot',
  nextSnapshot: 'Next snapshot',
  timelineLabel: 'Snapshot year',
  timelineHelp:
    'Use the left and right arrow keys to step between snapshots. The slider stops only at years that exist in the dataset — there is nothing in between.',
  timelineNote:
    'Snapshots are spaced evenly along this axis, not in proportion to elapsed time. The gaps between them range from a decade to tens of millennia.',
  goToYear: (year) => `Go to the ${year} snapshot`,
  snapshotPosition: (index, total) => `Snapshot ${index} of ${total}`,

  basemapToggle: 'Modern basemap',
  basemapOn: 'on',
  basemapOff: 'off',
  basemapHintAncient:
    'The basemap is off by default before AD 1000: modern coastlines, lakes and rivers differ from ancient ones and can mislead.',

  resetView: 'Europe',
  resetViewTitle: 'Reset the view to Europe',

  resetWorld: 'World',
  resetWorldTitle: 'Reset the view to the whole world',

  panelClose: 'Close',
  panelNoSelection: 'Select a territory on the map to see its dataset record.',
  panelPreviewHint: 'Preview — click the territory to keep this open.',
  panelPinnedHint: 'Pinned. Close this panel to go back to hover preview.',
  unnamedTerritory: 'Unnamed territory',
  notInDataset: 'not in dataset',

  datasetProperties: 'Dataset record',
  propertyLabels: {
    NAME: 'Name',
    ABBREVN: 'Abbreviated name',
    SUBJECTO: 'Subject of',
    PARTOF: 'Part of',
    BORDERPRECISION: 'Border precision',
    wikipedia: 'Wikipedia (from dataset)',
    weblnks: 'Web links (from dataset)',
    weblinks: 'Web links (from dataset)',
    INFO_UR: 'Information URL (from dataset)',
    type: 'Type',
    TYPE: 'Type',
    CONTROL: 'Controlled by',
    cat: 'Category code',
    FIPS_CO: 'FIPS country code',
    WB_CNTR: 'World Bank country code',
    BORDER_: 'Border code',
    BORDERI: 'Borders with',
  },
  otherProperties: 'Other properties in this file',

  borderPrecisionScale: {
    '1': '1 — approximate',
    '2': '2 — moderately precise',
    '3': '3 — determined by international law',
  },
  borderPrecisionUndocumented: (value) =>
    `${value} — value not on the dataset's documented 1–3 scale`,

  sourceHeading: 'Where this shape comes from',
  sourceNote: (filename, year) =>
    `Geometry read from ${filename}, the dataset's snapshot for ${year}. It is not interpolated or adjusted.`,

  externalHeading: 'Look this up elsewhere',
  externalDisclaimer: 'External search — not part of the dataset.',
  wikipediaSearch: (name) => `Search Wikipedia for “${name}”`,

  disclaimerTitle: 'Borders before 1648 are approximations',
  disclaimerBody:
    'The dataset authors note that in Europe the concept of a fixed national boundary only becomes meaningful after the Peace of Westphalia (1648). Earlier polities had overlapping, gradual and often undefined frontiers. Treat every line on this map as a scholarly approximation, not a surveyed border.',
  disclaimerDismiss: 'Understood',

  legendHeading: 'Reading this map',
  legendColorNote:
    'Colour groups territories under the same power (“subject of”). Colours repeat — they identify groupings, not specific states. Hover or click a territory for its name.',
  legendPrecise: 'Solid outline: border recorded as precise (3)',
  legendApproximate: 'Dashed, faded: border recorded as approximate (1–2)',

  footerDataHeading: 'Border data',
  footerDataset: 'Historical Basemaps',
  footerDatasetAuthor: 'André Ourednik and contributors',
  footerLicense: 'Licensed under',
  footerLicenseName: 'GNU General Public License v3.0',
  footerSnapshotCommit: (commit) => `Dataset snapshot: commit ${commit}`,
  footerBasemapHeading: 'Basemap',
  footerBasemapAttribution: '© OpenStreetMap contributors © CARTO',
  footerRendererHeading: 'Rendering',
  footerRenderer: 'Rendered with MapLibre GL JS, licensed BSD-3-Clause.',
  footerMethodHeading: 'Method',
  footerMethodology:
    'Borders are historical approximations from an open scholarly dataset; precision varies and is displayed per territory. Snapshots are discrete — this site never interpolates between them. How finely the world is subdivided also varies by region and period: outside Europe, territories are typically mapped as much larger units.',
  footerSimplified: (tolerance) =>
    `Geometry simplified at build time (mapshaper, ${tolerance}) for load speed.`,
  footerUnsimplified: 'Geometry is served exactly as published upstream, unsimplified.',
  footerLanguageNote:
    'Only the interface is translated. Territory names and every other dataset value are shown exactly as the dataset records them, in its own language.',
};
