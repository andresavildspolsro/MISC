/**
 * The shape every translation must fill.
 *
 * This describes the *chrome* only. Dataset content — territory names,
 * `SUBJECTO`, `PARTOF` and every other property value — is always rendered in
 * the language the dataset itself uses, never translated, because translating
 * it would mean displaying something the source does not say.
 */

export type LocaleCode = 'en' | 'cs' | 'es';

export interface Strings {
  /** BCP-47 tag used for number grouping and the document's `lang` attribute. */
  localeTag: string;
  /** Name of this language, written in this language, for the picker. */
  localeName: string;
  /** Wikipedia subdomain the "external search" link should target. */
  wikipediaHost: string;

  languageLabel: string;

  /** Map chrome — MapLibre's own controls ship English tooltips otherwise. */
  zoomIn: string;
  zoomOut: string;
  toggleAttribution: string;
  mapAriaLabel: string;
  panelAriaLabel: string;
  factsAriaLabel: string;

  appTitle: string;
  appTagline: string;

  loading: string;
  loadingSnapshot: (year: string) => string;
  loadError: (year: string) => string;
  /** A ?year= that is not a dataset year is reported, never rounded silently. */
  unknownYearRequested: (requested: string, shown: string) => string;
  /** Start-up failure before any snapshot list exists. */
  manifestLoadError: string;

  showingYear: string;
  featureCount: (n: string) => string;

  yearBc: (n: string) => string;
  yearAd: (n: string) => string;

  play: string;
  pause: string;
  previousSnapshot: string;
  nextSnapshot: string;
  timelineLabel: string;
  timelineHelp: string;
  /** The axis is ordinal, not proportional — say so rather than imply otherwise. */
  timelineNote: string;
  goToYear: (year: string) => string;
  snapshotPosition: (index: string, total: string) => string;

  /** Clicking the big year readout opens a type-a-year jump box. */
  yearJumpTitle: string;
  yearJumpPlaceholder: string;
  /**
   * Shown after an interactive jump lands on the nearest snapshot. Unlike a
   * shared ?year= link (which refuses to substitute), a typed year is a
   * navigation request — but the substitution is still said out loud.
   */
  nearestSnapshotShown: (requested: string, shown: string) => string;

  basemapToggle: string;
  basemapOn: string;
  basemapOff: string;
  basemapHintAncient: string;

  resetView: string;
  resetViewTitle: string;
  resetWorld: string;
  resetWorldTitle: string;

  panelClose: string;
  panelNoSelection: string;
  /** Shown while the panel is following the pointer rather than a click. */
  panelPreviewHint: string;
  /** Shown once a click has pinned the panel to one territory. */
  panelPinnedHint: string;
  unnamedTerritory: string;
  notInDataset: string;

  datasetProperties: string;
  propertyLabels: Record<string, string>;
  otherProperties: string;

  borderPrecisionScale: Record<string, string>;
  /** For a value outside the documented 1–3 ordinal scale: report, don't guess. */
  borderPrecisionUndocumented: (value: string) => string;

  sourceHeading: string;
  sourceNote: (filename: string, year: string) => string;

  externalHeading: string;
  externalDisclaimer: string;
  wikipediaSearch: (name: string) => string;

  /**
   * The facts feature. Facts are added context, NOT dataset content — they are
   * kept out of the dataset panel, carry their own disclaimer, and each one is
   * expected to cite an external source.
   */
  factsToggle: string;
  factsHeading: string;
  factsDisclaimer: string;
  factsSource: string;
  factsUnverified: string;
  factsNoneForYear: string;
  factsUntranslated: string;

  /** The events layer: curriculum events as clickable map points. */
  eventsToggle: string;
  eventsDisclaimer: string;
  /** Notice after jumping to an event's year: borders come from a snapshot. */
  eventYearShown: (eventYear: string, snapshotYear: string) => string;
  eventMarkerTitle: (year: string, names: string) => string;

  disclaimerTitle: string;
  disclaimerBody: string;
  disclaimerDismiss: string;

  legendHeading: string;
  legendColorNote: string;
  legendPrecise: string;
  legendApproximate: string;

  footerDataHeading: string;
  footerDataset: string;
  footerDatasetAuthor: string;
  footerLicense: string;
  footerLicenseName: string;
  footerSnapshotCommit: (commit: string) => string;
  footerBasemapHeading: string;
  footerBasemapAttribution: string;
  footerRendererHeading: string;
  footerRenderer: string;
  footerMethodHeading: string;
  footerMethodology: string;
  footerSimplified: (tolerance: string) => string;
  footerUnsimplified: string;
  /** Dataset text is never translated; say so rather than let it look like a gap. */
  footerLanguageNote: string;
}
