import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

// MapLibre v6 locates its web worker relative to `import.meta.url`, which does
// not survive bundling — the worker then fails to start and no GeoJSON is ever
// tiled, leaving a blank map. Hand it a URL Vite has actually emitted.
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(maplibreWorkerUrl);

import { ChapterAxis } from './chapterAxis';
import { loadManifest, loadSnapshot, prefetchSnapshot } from './data';
import { assignEventsToSnapshots, type HistEvent } from './events';
import { EVENTS } from './eventsData';
import { resolveMilestones, type Period, type PeriodCategory } from './periods';
import { PERIODS } from './periodsData';
import { FACTS, factsForYear } from './facts';
import { FactsCard } from './factsCard';
import { formatCount, formatYear, formatYearShort } from './format';
import { featureContains } from './geo';
import { glossName } from './nameGlosses';
import { labelsFeatureCollection, territoryLabels, type TerritoryLabel } from './labels';
import { EUROPE_BOUNDS, TerritoryMap } from './map';
import { loadNameIndex, type NameIndex } from './nameIndex';
import { DetailPanel } from './panel';
import { fold, matchScore, SearchBox, type SearchResult } from './search';
import {
  LOCALE_CODES,
  LOCALES,
  localeCode,
  resolveInitialLocale,
  setLocale,
  strings,
  type LocaleCode,
} from './strings';
import { Timeline } from './timeline';
import type { Manifest, ManifestSnapshot, SnapshotCollection } from './types';

/**
 * The year after which the dataset authors consider a fixed national boundary a
 * meaningful concept in Europe (Peace of Westphalia). Snapshots at or before it
 * carry the approximation banner.
 */
const WESTPHALIA = 1648;

/**
 * Below this year the basemap starts hidden: modern coastlines, lakes and
 * rivers diverge enough from ancient ones to mislead. A manual toggle always
 * wins over this default.
 */
const BASEMAP_AUTO_HIDE_BEFORE = 1000;

const DISCLAIMER_DISMISSED_KEY = 'historical-map:disclaimer-dismissed';
const FACTS_OPEN_KEY = 'historical-map:facts-open';
const EVENTS_OPEN_KEY = 'historical-map:events-open';
const LABELS_OPEN_KEY = 'historical-map:labels-open';
const HELP_SEEN_KEY = 'historical-map:help-seen';

/** Most results the search list shows; it is a shortlist, not a directory. */
const SEARCH_LIMIT = 10;

/**
 * Grace period before a hover preview closes after the pointer leaves the map.
 * Long enough to cross the gap onto the panel itself and read it, short enough
 * that the panel does not linger once attention has moved on.
 */
const HOVER_CLOSE_DELAY_MS = 180;

/* ------------------------------------------------------------------ helpers */

function applyStaticStrings(): void {
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset.i18n as keyof typeof strings | undefined;
    if (!key) continue;
    const value = strings[key];
    if (typeof value === 'string') node.textContent = value;
  }
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = node.dataset.i18nAria as keyof typeof strings | undefined;
    if (!key) continue;
    const value = strings[key];
    if (typeof value === 'string') node.setAttribute('aria-label', value);
  }
}

function requireElement<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`missing element: ${selector}`);
  return node;
}

interface RequestedYear {
  index: number | null;
  /** Present when `?year=` named a year the dataset does not cover. */
  unmatched: string | null;
}

/** Resolves `?year=` to a snapshot index. */
function indexFromLocation(snapshots: ManifestSnapshot[]): RequestedYear {
  const raw = new URLSearchParams(window.location.search).get('year');
  if (raw === null) return { index: null, unmatched: null };

  const year = Number(raw);
  if (!Number.isFinite(year)) return { index: null, unmatched: raw };

  // Deliberately an exact match: a year with no file is not rounded to a
  // neighbouring snapshot, because that would show borders for the wrong year.
  const index = snapshots.findIndex((snapshot) => snapshot.year === year);
  return index === -1 ? { index: null, unmatched: raw } : { index, unmatched: null };
}

function resolveBasemapSources(manifest: Manifest) {
  const files = manifest.basemap?.files;
  const coarseLand = files?.ne_110m_land?.path;
  const coarseLakes = files?.ne_110m_lakes?.path;
  const detailLand = files?.ne_50m_land?.path;
  const detailLakes = files?.ne_50m_lakes?.path;
  if (!coarseLand || !coarseLakes || !detailLand || !detailLakes) return null;
  return { coarseLand, coarseLakes, detailLand, detailLakes };
}

/* --------------------------------------------------------------------- app */

class App {
  private readonly manifest: Manifest;
  private readonly snapshots: ManifestSnapshot[];

  private readonly map: TerritoryMap;
  private readonly panel: DetailPanel;
  private readonly timeline: Timeline;

  private readonly statusNode = requireElement('#status');
  private readonly featuresNode = requireElement('#timeline-features');
  private readonly disclaimerNode = requireElement('#disclaimer');
  private readonly basemapButton = requireElement<HTMLButtonElement>('#basemap-toggle');
  private readonly basemapHintNode = requireElement('#basemap-hint');
  private readonly labelsToggle = requireElement<HTMLButtonElement>('#labels-toggle');
  private labelsOpen = true;
  private readonly helpToggle = requireElement<HTMLButtonElement>('#help-toggle');
  private readonly legendNode = requireElement<HTMLElement>('#legend');
  private readonly search: SearchBox;
  /** Loaded on the first search; null until then. */
  private nameIndex: NameIndex | null = null;
  /** One-shot continuation once the next snapshot has loaded (search jumps). */
  private afterLoad: (() => void) | null = null;
  private readonly languageSelect = requireElement<HTMLSelectElement>('#language-select');
  private readonly languageLabelNode = requireElement('#language-label');
  private readonly factsToggle = requireElement<HTMLButtonElement>('#facts-toggle');
  private readonly factsCard = new FactsCard(requireElement('#facts'));
  private factsOpen = false;
  private readonly eventsToggle = requireElement<HTMLButtonElement>('#events-toggle');
  /** Events keyed by the snapshot year they belong to (first at/after). */
  private eventsBySnapshot = new Map<number, HistEvent[]>();
  private eventsById = new Map<string, HistEvent>();
  /** The layer defaults to on — the points are the reason the map is fun. */
  private eventsOpen = true;

  private readonly chaptersDrawer = requireElement<HTMLElement>('#chapters');
  private readonly chapterNode = requireElement('#chapter');
  private readonly timelineNode = requireElement('#timeline');
  private readonly chapterAxis: ChapterAxis;
  private activePeriod: Period | null = null;
  private periodMilestones: HistEvent[] = [];
  /** Milestones resolved once at start-up so broken references warn early. */
  private readonly milestonesByPeriod = new Map<string, HistEvent[]>();

  /** Toggle overlay of the newest snapshot's borders, for comparison. */
  private readonly modernToggle = requireElement<HTMLButtonElement>('#modern-toggle');
  private modernOn = false;
  private modernRequested = false;

  private readonly aboutDialog = requireElement<HTMLDialogElement>('#about');
  private readonly worldCrumb = requireElement<HTMLButtonElement>('#reset-world');
  private readonly europeCrumb = requireElement<HTMLButtonElement>('#reset-view');
  /** Narrow screens get a bottom sheet instead of map popups. */
  private readonly narrow = window.matchMedia('(max-width: 700px)');

  private collection: SnapshotCollection | null = null;
  private currentIndex = 0;
  /** Set once the user touches the basemap toggle; suppresses the auto default. */
  private basemapManual = false;
  /** Guards against a slow snapshot landing after the user moved on. */
  private loadToken = 0;
  /** Message to show once the next snapshot has loaded (e.g. nearest-year note). */
  private pendingNotice: string | null = null;
  private noticeTimer: number | null = null;
  /**
   * The panel has two states. `pinned` is set by a click and stays put while
   * the pointer wanders; `preview` follows the pointer and only applies when
   * nothing is pinned. Whichever is active is what a language change re-renders.
   */
  private pinnedFeatureIndex: number | null = null;
  private previewFeatureIndex: number | null = null;
  private hoverCloseTimer: number | null = null;

  constructor(manifest: Manifest) {
    this.manifest = manifest;
    this.snapshots = manifest.snapshots;

    this.map = new TerritoryMap(
      requireElement('#map'),
      requireElement('#tooltip'),
      {
        onSelect: (index) => this.handleSelect(index),
        onHover: (index) => this.handleHover(index),
        onEventsClick: (ids, at) => this.handleEventsClick(ids, at),
        onPopupClose: () => this.map.setSpotlight(null),
        onViewChange: (zoom, center) => this.updateBreadcrumb(zoom, center),
      },
      // A stale cached manifest may predate the vendored basemap. The map
      // must come up without it rather than dying in the constructor.
      resolveBasemapSources(manifest),
      manifest.fonts ?? null,
    );

    this.search = new SearchBox(requireElement<HTMLFormElement>('#search'), {
      query: (text) => this.searchQuery(text),
      pick: (result) => this.searchPick(result),
      onFocus: () => void this.ensureNameIndex(),
    });

    this.panel = new DetailPanel(requireElement('#panel'), () => this.clearSelection());

    const requested = indexFromLocation(this.snapshots);
    const initialIndex = requested.index ?? this.snapshots.length - 1;

    this.eventsBySnapshot = assignEventsToSnapshots(
      EVENTS,
      this.snapshots.map((snapshot) => snapshot.year),
    );
    for (const event of EVENTS) this.eventsById.set(event.id, event);

    this.timeline = new Timeline(requireElement('#timeline'), this.snapshots, {
      onChange: (index) => void this.goTo(index),
      onEventYear: (year) => this.handleEventYear(year),
      onNearestJump: (requestedYear, landedIndex) => {
        const message = strings.nearestSnapshotShown(
          formatYear(requestedYear),
          formatYear(this.snapshots[landedIndex].year),
        );
        if (landedIndex === this.currentIndex) {
          // No navigation will happen, so no goTo() will deliver the notice.
          this.showTransient(message);
        } else {
          this.pendingNotice = message;
        }
      },
    });

    this.chapterAxis = new ChapterAxis(this.chapterNode, {
      onMilestone: (index) => this.openMilestone(index),
    });
    for (const period of PERIODS) {
      this.milestonesByPeriod.set(period.id, resolveMilestones(period, this.eventsById));
    }

    this.bindChrome();
    this.applyViewButtonTitles();
    this.renderFooter();
    this.renderChaptersDrawer();
    this.languageLabelNode.textContent = strings.languageLabel;

    this.timeline.setIndex(initialIndex);
    void this.goTo(initialIndex).then(() => {
      if (requested.unmatched !== null) {
        this.setStatus(
          strings.unknownYearRequested(
            requested.unmatched,
            formatYear(this.snapshots[initialIndex].year),
          ),
          true,
        );
      }
    });

    // A deep-linked chapter takes over from the plain year once the app is
    // up; `&m=<event id>` lands on that milestone instead of the first.
    const params = new URLSearchParams(window.location.search);
    const linkedPeriod = PERIODS.find((period) => period.id === params.get('period'));
    if (linkedPeriod) {
      const milestones = this.milestonesByPeriod.get(linkedPeriod.id) ?? [];
      const milestoneIndex = milestones.findIndex((event) => event.id === params.get('m'));
      this.enterChapter(linkedPeriod, Math.max(0, milestoneIndex));
    }
  }

  /* ------------------------------------------------------------- chrome */

  private bindChrome(): void {
    for (const code of LOCALE_CODES) {
      const option = document.createElement('option');
      option.value = code;
      // Each language is named in its own language, so it is recognisable to
      // someone who cannot read the language currently on screen.
      option.textContent = LOCALES[code].localeName;
      this.languageSelect.append(option);
    }
    this.languageSelect.value = localeCode;
    this.languageSelect.addEventListener('change', () => {
      this.setLanguage(this.languageSelect.value as LocaleCode);
    });

    this.basemapButton.addEventListener('click', () => {
      this.basemapManual = true;
      this.setBasemap(!this.map.isBasemapVisible());
    });

    // Territory names on the map. Only offered when glyphs were vendored.
    if (this.map.hasLabels()) {
      this.labelsToggle.hidden = false;
      try {
        const stored = window.localStorage.getItem(LABELS_OPEN_KEY);
        if (stored !== null) this.labelsOpen = stored === '1';
      } catch {
        /* default stays on */
      }
      this.applyLabelsToggle();
      this.labelsToggle.addEventListener('click', () => {
        this.labelsOpen = !this.labelsOpen;
        try {
          window.localStorage.setItem(LABELS_OPEN_KEY, this.labelsOpen ? '1' : '0');
        } catch {
          /* fine */
        }
        this.applyLabelsToggle();
      });
    }

    // The help card: legend plus "how to start". Open on the first visit,
    // a small "?" button afterwards.
    this.renderHelpSteps();
    let helpSeen = false;
    try {
      helpSeen = window.localStorage.getItem(HELP_SEEN_KEY) === '1';
    } catch {
      /* show it */
    }
    this.setHelpOpen(!helpSeen);
    this.helpToggle.addEventListener('click', () => this.setHelpOpen(this.legendNode.hidden === true));
    requireElement('#help-close').addEventListener('click', () => this.setHelpOpen(false));
    requireElement('#help-ok').addEventListener('click', () => this.setHelpOpen(false));

    requireElement('#reset-view').addEventListener('click', () => this.map.resetView());
    requireElement('#reset-world').addEventListener('click', () => this.map.resetWorldView());

    requireElement('#disclaimer-dismiss').addEventListener('click', () => {
      try {
        window.sessionStorage.setItem(DISCLAIMER_DISMISSED_KEY, '1');
      } catch {
        /* private mode: the banner simply reappears next time */
      }
      this.disclaimerNode.hidden = true;
    });

    // A fact tied to a year with no snapshot can never render; say so loudly
    // in the console instead of letting the entry rot unnoticed.
    const knownYears = new Set(this.snapshots.map((snapshot) => snapshot.year));
    for (const fact of FACTS) {
      const orphaned = fact.years.filter((year) => !knownYears.has(year));
      if (orphaned.length > 0) {
        console.warn(`fact "${fact.id}" references non-dataset years: ${orphaned.join(', ')}`);
      }
    }

    // Facts stay entirely dormant until the curated list actually has entries.
    if (FACTS.length > 0) {
      this.factsToggle.hidden = false;
      try {
        this.factsOpen = window.localStorage.getItem(FACTS_OPEN_KEY) === '1';
      } catch {
        /* per-session default only */
      }
      this.factsToggle.addEventListener('click', () => {
        this.factsOpen = !this.factsOpen;
        try {
          window.localStorage.setItem(FACTS_OPEN_KEY, this.factsOpen ? '1' : '0');
        } catch {
          /* fine */
        }
        this.refreshFacts();
      });
    }

    if (EVENTS.length > 0) {
      this.eventsToggle.hidden = false;
      try {
        const stored = window.localStorage.getItem(EVENTS_OPEN_KEY);
        if (stored !== null) this.eventsOpen = stored === '1';
      } catch {
        /* default stays on */
      }
      this.eventsToggle.addEventListener('click', () => {
        this.eventsOpen = !this.eventsOpen;
        try {
          window.localStorage.setItem(EVENTS_OPEN_KEY, this.eventsOpen ? '1' : '0');
        } catch {
          /* fine */
        }
        this.refreshEvents();
      });
      this.publishEventMarks();
    }

    this.bindModernToggle();

    requireElement('#chapters-open').addEventListener('click', () => this.setChaptersOpen(true));
    requireElement('#chapters-close').addEventListener('click', () => this.setChaptersOpen(false));
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.chaptersDrawer.hidden) this.setChaptersOpen(false);
    });

    requireElement('#about-open').addEventListener('click', () => this.aboutDialog.showModal());
    requireElement('#about-close').addEventListener('click', () => this.aboutDialog.close());
    // A click on the backdrop (outside the dialog box) closes it too.
    this.aboutDialog.addEventListener('click', (event) => {
      if (event.target === this.aboutDialog) this.aboutDialog.close();
    });

    requireElement('#chapter-exit').addEventListener('click', () => this.exitChapter());
    requireElement<HTMLButtonElement>('#chapter-prestate').addEventListener('click', () => {
      const index = Number(requireElement('#chapter-prestate').dataset.index);
      if (!Number.isInteger(index)) return;
      this.timeline.syncIndex(index);
      void this.goTo(index);
    });

    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkQuery.addEventListener('change', (event) => this.map.setDark(event.matches));

    // Moving from the map onto the panel counts as still reading it, so the
    // pending close is cancelled; leaving the panel restarts it.
    const panelNode = requireElement('#panel');
    panelNode.addEventListener('mouseenter', () => this.cancelHoverClose());
    panelNode.addEventListener('mouseleave', () => {
      if (this.pinnedFeatureIndex === null) this.scheduleHoverClose();
    });

    window.addEventListener('resize', () => {
      this.map.resize();
      this.updateChromePadding();
    });
    this.updateChromePadding();
  }

  /**
   * The dock (or the chapter card) covers the foot of the map; the camera is
   * told so, and re-told whenever the covering element changes.
   */
  private updateChromePadding(): void {
    const covering = this.activePeriod ? this.chapterNode : this.timelineNode;
    const bottom = covering.hidden ? 0 : covering.offsetHeight + 12;
    // The layer chips and facts stack sit top-left; a modest top margin keeps
    // a centred point from landing under them.
    this.map.setChromePadding({ bottom, top: 48 });
  }

  /**
   * The "Today's borders" chip: today's borders — the newest snapshot of the
   * same dataset — overlay the map as an outline for comparison while the
   * chip is on. The snapshot is fetched on the first press, not at start-up.
   */
  private bindModernToggle(): void {
    this.applyModernToggleTitle();
    this.modernToggle.addEventListener('click', () => this.setModern(!this.modernOn));
  }

  private setModern(on: boolean): void {
    this.modernOn = on;
    this.modernToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (!on) {
      this.map.setModernVisible(false);
      return;
    }
    if (!this.modernRequested) {
      this.modernRequested = true;
      void loadSnapshot(this.snapshots[this.snapshots.length - 1])
        .then((collection) => {
          this.map.setModernData(collection);
          if (this.modernOn) this.map.setModernVisible(true);
        })
        .catch((error) => {
          console.error(error);
          this.modernRequested = false; // let a later press retry
          this.setModern(false);
        });
      return;
    }
    this.map.setModernVisible(true);
  }

  private applyModernToggleTitle(): void {
    const title = strings.modernToggleTitle(
      formatYear(this.snapshots[this.snapshots.length - 1].year),
    );
    this.modernToggle.title = title;
    this.modernToggle.setAttribute('aria-label', title);
  }

  /* --------------------------------------------------------- breadcrumb */

  /**
   * Marks which of the two named views the map is showing, if either: the
   * world when zoomed right out, Europe when the centre sits inside the
   * Europe frame at a continental zoom. Anything else is simply "elsewhere"
   * and neither crumb is current.
   */
  private updateBreadcrumb(zoom: number, center: [number, number]): void {
    const [[west, south], [east, north]] = EUROPE_BOUNDS as [[number, number], [number, number]];
    const inEurope =
      zoom >= 2 && center[0] >= west && center[0] <= east && center[1] >= south && center[1] <= north;
    const world = zoom < 1.6;
    this.worldCrumb.setAttribute('aria-current', world ? 'true' : 'false');
    this.europeCrumb.setAttribute('aria-current', inEurope ? 'true' : 'false');
  }

  private setLanguage(code: LocaleCode): void {
    setLocale(code);

    const url = new URL(window.location.href);
    url.searchParams.set('lang', code);
    window.history.replaceState(null, '', url);

    this.retranslate();
  }

  /**
   * Repaints every piece of chrome in the new language. Dataset values are not
   * touched: the panel re-renders the same feature, whose properties are still
   * shown exactly as the file stores them.
   */
  private retranslate(): void {
    applyStaticStrings();
    this.languageSelect.value = localeCode;
    this.languageLabelNode.textContent = strings.languageLabel;
    this.renderFooter();
    this.timeline.retranslate();
    this.panel.retranslate();
    this.map.retranslate();
    this.map.closePopup();
    this.refreshFacts();
    this.refreshEvents();
    this.publishEventMarks();
    this.renderChaptersDrawer();
    this.renderChapterChrome();
    this.chapterAxis.retranslate();
    this.applyModernToggleTitle();
    this.search.retranslate();
    this.renderHelpSteps();
    this.publishLabels();

    const snapshot = this.snapshots[this.currentIndex];
    this.setBasemap(this.map.isBasemapVisible());
    this.updateBasemapDefaultHint(snapshot.year);
    this.applyViewButtonTitles();

    if (this.collection) {
      this.featuresNode.textContent = strings.featureCount(
        formatCount(this.collection.features.length),
      );
      this.setStatus(null);
    } else {
      this.setStatus(strings.loadError(formatYear(snapshot.year)), true);
    }

    const activeIndex = this.pinnedFeatureIndex ?? this.previewFeatureIndex;
    const feature =
      activeIndex !== null ? this.collection?.features[activeIndex] : undefined;
    if (feature) {
      this.panel.show(feature, snapshot, this.pinnedFeatureIndex !== null ? 'pinned' : 'preview');
    } else {
      this.panel.showEmpty();
    }
  }

  /** Marks on the timeline: one per distinct event year, localized names. */
  private publishEventMarks(): void {
    const byYear = new Map<number, string[]>();
    for (const event of EVENTS) {
      const names = byYear.get(event.year) ?? [];
      names.push(event.name[localeCode]);
      byYear.set(event.year, names);
    }
    this.timeline.setEventYears(
      [...byYear.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, names]) => ({ year, names })),
    );
  }

  /**
   * Updates the events toggle and pushes the current points. In chapter mode
   * the points are the chapter's milestones instead of the snapshot bucket —
   * and only those at or before the shown snapshot's year, so no event ever
   * sits on a map older than itself.
   */
  private refreshEvents(): void {
    if (EVENTS.length === 0) return;
    const year = this.snapshots[this.currentIndex].year;
    // Inside a chapter the points are its milestones and cannot be switched
    // off, so the toggle would only mislead.
    this.eventsToggle.hidden = this.activePeriod !== null;

    if (this.activePeriod) {
      // Cut-off is the earlier of the shown snapshot and the current milestone:
      // the snapshot bound keeps the anachronism rule (nothing newer than the
      // map), the milestone bound makes stepping through a chapter reveal its
      // story point by point instead of spoiling it all at once.
      const milestoneYear =
        this.periodMilestones[this.chapterAxis.currentIndex]?.year ?? Number.POSITIVE_INFINITY;
      const cutoff = Math.min(year, milestoneYear);
      const milestones = this.periodMilestones.filter((event) => event.year <= cutoff);
      if (milestones.length === 0) this.map.clearEventsData();
      else this.map.setEventsData(this.toFeatureCollection(milestones));
      return;
    }

    const events = this.eventsBySnapshot.get(year) ?? [];
    this.eventsToggle.textContent = `${strings.eventsToggle} (${events.length})`;
    this.eventsToggle.setAttribute('aria-pressed', this.eventsOpen ? 'true' : 'false');

    if (!this.eventsOpen || events.length === 0) {
      this.map.clearEventsData();
      return;
    }
    this.map.setEventsData(this.toFeatureCollection(events));
  }

  private toFeatureCollection(events: HistEvent[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: events.map((event) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [event.lon, event.lat] },
        properties: {
          id: event.id,
          label: `${formatYear(event.year)} — ${event.name[localeCode]}`,
        },
      })),
    };
  }

  /* ----------------------------------------------------------- chapters */

  /**
   * Renders the chapters drawer: every chapter, grouped by category, each
   * with its years and one-line description. Opened from the dock.
   */
  private renderChaptersDrawer(): void {
    const list = requireElement('#chapters-list');
    list.innerHTML = '';

    const categories: Array<{ key: PeriodCategory; label: string }> = [
      { key: 'war', label: strings.chapterCategoryWar },
      { key: 'discovery', label: strings.chapterCategoryDiscovery },
      { key: 'revolution', label: strings.chapterCategoryRevolution },
      { key: 'era', label: strings.chapterCategoryEra },
    ];

    for (const category of categories) {
      const periods = PERIODS.filter((period) => period.category === category.key);
      if (periods.length === 0) continue;

      const heading = document.createElement('h3');
      heading.className = 'drawer__group';
      heading.textContent = `${category.label} (${periods.length})`;
      list.append(heading);

      for (const period of periods) {
        const range = this.periodRange(period);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'chapter-item';
        item.classList.toggle('chapter-item--active', this.activePeriod?.id === period.id);
        item.setAttribute('aria-label', strings.chapterOpenAria(period.name[localeCode], range));
        const name = document.createElement('span');
        name.className = 'chapter-item__name';
        name.textContent = period.name[localeCode];
        const years = document.createElement('span');
        years.className = 'chapter-item__range';
        years.textContent = range;
        const desc = document.createElement('span');
        desc.className = 'chapter-item__desc';
        desc.textContent = period.description[localeCode];
        item.append(name, years, desc);
        item.addEventListener('click', () => {
          this.setChaptersOpen(false);
          this.enterChapter(period);
        });
        list.append(item);
      }
    }
  }

  private setChaptersOpen(open: boolean): void {
    this.chaptersDrawer.hidden = !open;
    requireElement('#chapters-open').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      this.renderChaptersDrawer();
      this.chaptersDrawer.querySelector<HTMLElement>('.chapter-item--active, .chapter-item')?.focus();
    }
  }

  private periodRange(period: Period): string {
    return `${formatYearShort(period.start)}–${formatYearShort(period.end)}`;
  }

  private enterChapter(period: Period, milestoneIndex = 0): void {
    const milestones = this.milestonesByPeriod.get(period.id) ?? [];
    if (milestones.length === 0) {
      console.warn(`chapter "${period.id}" has no usable milestones; not opening`);
      return;
    }
    this.timeline.stop();
    this.clearSelection();
    this.activePeriod = period;
    this.periodMilestones = milestones;

    this.setChaptersOpen(false);
    this.timelineNode.hidden = true;
    this.chapterNode.hidden = false;

    this.renderChapterChrome();
    this.chapterAxis.setPeriod(period, milestones);
    this.updateChromePadding();
    this.map.focusBounds(period.bounds);
    this.map.setSides(
      period.sides?.map((side) => ({ names: side.territories })) ?? null,
    );

    const url = new URL(window.location.href);
    url.searchParams.set('period', period.id);
    window.history.replaceState(null, '', url);

    this.openMilestone(milestoneIndex);
  }

  private exitChapter(): void {
    if (!this.activePeriod) return;
    this.chapterAxis.clear();
    this.activePeriod = null;
    this.periodMilestones = [];

    this.chapterNode.hidden = true;
    this.timelineNode.hidden = false;
    this.map.setSides(null);
    this.updateChromePadding();

    const url = new URL(window.location.href);
    url.searchParams.delete('period');
    url.searchParams.delete('m');
    window.history.replaceState(null, '', url);

    this.map.closePopup();
    this.refreshEvents();
    this.map.resetWorldView();
  }

  /** Everything in the chapter header except the axis itself. */
  private renderChapterChrome(): void {
    const period = this.activePeriod;
    if (!period) return;

    requireElement('#chapter-title').textContent = period.name[localeCode];
    requireElement('#chapter-range').textContent = this.periodRange(period);
    requireElement('#chapter-desc').textContent = period.description[localeCode];
    this.renderSidesLegend(period);

    const note = requireElement('#chapter-note');
    const hasSnapshotInRange = this.snapshots.some(
      (snapshot) => snapshot.year >= period.start && snapshot.year <= period.end,
    );
    note.hidden = hasSnapshotInRange;
    note.textContent = hasSnapshotInRange ? '' : strings.chapterNoSnapshotInRange;

    const source = requireElement('#chapter-source');
    source.innerHTML = '';
    const link = document.createElement('a');
    link.href = period.source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = period.source.label;
    source.append(document.createTextNode(`${strings.factsSource}: `), link);

    // The last snapshot before the chapter starts, if any: the "before" state.
    const prestate = requireElement<HTMLButtonElement>('#chapter-prestate');
    let beforeIndex = -1;
    for (let i = 0; i < this.snapshots.length; i += 1) {
      if (this.snapshots[i].year < period.start) beforeIndex = i;
    }
    prestate.hidden = beforeIndex === -1;
    if (beforeIndex !== -1) {
      prestate.textContent = strings.chapterPreState(formatYear(this.snapshots[beforeIndex].year));
      prestate.dataset.index = String(beforeIndex);
    }

    this.updateChapterBadge();
  }

  /** Colour-keyed legend of the chapter's conflict sides, when it has any. */
  private renderSidesLegend(period: Period): void {
    const node = requireElement('#chapter-sides');
    node.innerHTML = '';
    const sides = period.sides ?? [];
    node.hidden = sides.length === 0;
    if (sides.length === 0) return;

    const label = document.createElement('span');
    label.className = 'chapter__sides-label';
    label.textContent = `${strings.chapterSidesLabel}:`;
    node.append(label);

    sides.forEach((side, index) => {
      const chip = document.createElement('span');
      chip.className = 'sidechip';
      const swatch = document.createElement('span');
      // Swatch colours live in CSS (.sidechip__swatch--N), matching the map's
      // SIDE_COLORS in both themes.
      swatch.className = `sidechip__swatch sidechip__swatch--${index % 3}`;
      swatch.setAttribute('aria-hidden', 'true');
      chip.append(swatch, document.createTextNode(side.name[localeCode]));
      node.append(chip);
    });
  }

  /** The permanent "Borders: <year> snapshot" badge in the chapter header. */
  private updateChapterBadge(): void {
    if (!this.activePeriod) return;
    requireElement('#chapter-badge').textContent = strings.chapterBordersFrom(
      formatYear(this.snapshots[this.currentIndex].year),
    );
  }

  /** Navigates to a milestone: nearest following snapshot, then its popup. */
  private openMilestone(index: number): void {
    const event = this.periodMilestones[index];
    if (!event) return;
    this.chapterAxis.syncIndex(index);

    // Keep the milestone in the URL so this exact spot can be shared.
    const url = new URL(window.location.href);
    url.searchParams.set('m', event.id);
    window.history.replaceState(null, '', url);

    const snapshotIndex = this.snapshots.findIndex((snapshot) => snapshot.year >= event.year);
    if (snapshotIndex === -1) return;

    const showPopup = () => this.handleEventsClick([event.id], [event.lon, event.lat]);
    if (snapshotIndex !== this.currentIndex) {
      this.timeline.syncIndex(snapshotIndex);
      void this.goTo(snapshotIndex).then(showPopup);
    } else {
      this.refreshEvents();
      this.updateChapterBadge();
      showPopup();
    }
  }

  /** Popup listing every event under the tap, each with its year and source. */
  private handleEventsClick(ids: string[], at: unknown): void {
    const events = ids
      .map((id) => this.eventsById.get(id))
      .filter((event): event is HistEvent => Boolean(event));
    if (events.length === 0) return;

    const root = document.createElement('div');
    root.className = 'evpop';
    const disclaimer = document.createElement('p');
    disclaimer.className = 'evpop__disclaimer';
    disclaimer.textContent = strings.eventsDisclaimer;
    root.append(disclaimer);

    for (const event of events) {
      const item = document.createElement('div');
      item.className = 'evpop__item';
      const head = document.createElement('p');
      head.className = 'evpop__head';
      const yearNode = document.createElement('span');
      yearNode.className = 'evpop__year';
      yearNode.textContent = formatYear(event.year);
      head.append(yearNode, document.createTextNode(` ${event.name[localeCode]}`));
      const body = document.createElement('p');
      body.className = 'evpop__text';
      body.textContent = event.description[localeCode];
      const src = document.createElement('p');
      src.className = 'evpop__source';
      const link = document.createElement('a');
      link.href = event.source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = event.source.label;
      src.append(document.createTextNode(`${strings.factsSource}: `), link);
      item.append(head, body, src);
      root.append(item);
    }
    if (this.narrow.matches && !this.activePeriod) {
      // A map popup on a phone is clipped by the edges and hides the map
      // under it; the bottom sheet reads better and scrolls.
      this.map.closePopup();
      this.clearSelection();
      const title =
        events.length === 1
          ? `${formatYear(events[0].year)} — ${events[0].name[localeCode]}`
          : strings.eventsToggle;
      this.panel.showCustom(title, root);
      this.panel.setOpen(true);
    } else {
      this.map.showPopup(at as [number, number], root);
    }
    this.spotlightEvents(events);
  }

  /**
   * While an event popup is open, the dataset territories containing the
   * event's coordinates stay lit and the rest of the map dims. Pure lookup:
   * the spotlight is the dataset's own polygons, never a drawn region. Events
   * at sea or on unmapped ground spotlight nothing and the map stays as is.
   */
  private spotlightEvents(events: HistEvent[]): void {
    // Inside a chapter the frame and the side tints already carry the context,
    // and the milestone popup is open nearly all the time — a permanent veil
    // would just hide the sides. The spotlight belongs to the main view.
    if (this.activePeriod) {
      this.map.setSpotlight(null);
      return;
    }
    const features = this.collection?.features;
    if (!features) return;
    const ids = new Set<number>();
    for (const event of events) {
      features.forEach((feature, index) => {
        if (featureContains(feature, event.lon, event.lat)) ids.add(index);
      });
    }
    this.map.setSpotlight(ids.size > 0 ? [...ids] : null);
  }

  /** A timeline anchor mark: jump to the first snapshot after the event. */
  private handleEventYear(year: number): void {
    const index = this.snapshots.findIndex((snapshot) => snapshot.year >= year);
    if (index === -1) return;

    if (!this.eventsOpen) {
      this.eventsOpen = true;
      try {
        window.localStorage.setItem(EVENTS_OPEN_KEY, '1');
      } catch {
        /* fine */
      }
    }

    const message =
      this.snapshots[index].year === year
        ? null
        : strings.eventYearShown(formatYear(year), formatYear(this.snapshots[index].year));
    if (index === this.currentIndex) {
      if (message) this.showTransient(message);
      this.refreshEvents();
    } else {
      if (message) this.pendingNotice = message;
      this.timeline.setIndex(index);
    }
  }

  /** Updates the toggle label/count and the card for the current snapshot. */
  private refreshFacts(): void {
    if (FACTS.length === 0) return;
    const year = this.snapshots[this.currentIndex].year;
    const count = factsForYear(year).length;
    this.factsToggle.textContent = `${strings.factsToggle} (${count})`;
    this.factsToggle.setAttribute('aria-pressed', this.factsOpen ? 'true' : 'false');
    if (this.factsOpen) this.factsCard.render(year);
    this.factsCard.setOpen(this.factsOpen);
  }

  private applyViewButtonTitles(): void {
    requireElement('#reset-view').setAttribute('title', strings.resetViewTitle);
    requireElement('#reset-world').setAttribute('title', strings.resetWorldTitle);
  }

  private renderFooter(): void {
    requireElement('#footer-commit').textContent = strings.footerSnapshotCommit(
      this.manifest.generatedFrom.commit.slice(0, 10),
    );
    requireElement('#footer-simplification').textContent = this.manifest.simplified
      ? strings.footerSimplified(this.manifest.simplified.tolerance)
      : strings.footerUnsimplified;
  }

  private setBasemap(visible: boolean): void {
    this.map.setBasemapVisible(visible);
    this.basemapButton.setAttribute('aria-pressed', visible ? 'true' : 'false');
  }

  private applyLabelsToggle(): void {
    this.map.setLabelsVisible(this.labelsOpen);
    this.labelsToggle.setAttribute('aria-pressed', this.labelsOpen ? 'true' : 'false');
  }

  /* -------------------------------------------------------------- help */

  private setHelpOpen(open: boolean): void {
    this.legendNode.hidden = !open;
    this.helpToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) {
      try {
        window.localStorage.setItem(HELP_SEEN_KEY, '1');
      } catch {
        /* it will open again next time; harmless */
      }
    }
  }

  private renderHelpSteps(): void {
    const list = requireElement('#help-steps');
    list.innerHTML = '';
    for (const step of strings.helpSteps) {
      const item = document.createElement('li');
      item.textContent = step;
      list.append(item);
    }
  }

  /* ------------------------------------------------------------ labels */

  /**
   * Publishes name labels for the loaded snapshot. Placement is computed once
   * per collection (see src/labels.ts) and deferred a tick so the borders
   * themselves paint first on a dense snapshot.
   */
  private publishLabels(): void {
    if (!this.map.hasLabels()) return;
    const collection = this.collection;
    if (!collection) {
      this.map.clearLabelsData();
      return;
    }
    const token = this.loadToken;
    window.setTimeout(() => {
      if (token !== this.loadToken || this.collection !== collection) return;
      this.map.setLabelsData(labelsFeatureCollection(territoryLabels(collection), localeCode));
    }, 0);
  }

  /* ------------------------------------------------------------ search */

  private async ensureNameIndex(): Promise<NameIndex> {
    if (!this.nameIndex) this.nameIndex = await loadNameIndex(this.manifest);
    return this.nameIndex;
  }

  /**
   * Everything the search can find for a query, best first: a typed year,
   * territories of the shown snapshot, chapters, events, then territories the
   * dataset only has in other years. Names are matched both verbatim and via
   * their curated translation, diacritics ignored.
   */
  private async searchQuery(text: string): Promise<SearchResult[]> {
    const q = fold(text);
    if (!q) return [];
    const index = await this.ensureNameIndex();
    const currentYear = this.snapshots[this.currentIndex].year;

    type Scored = { score: number; priority: number; result: SearchResult };
    const scored: Scored[] = [];

    const yearMatch = /^(-?\d{1,6})$/.exec(text.trim());
    if (yearMatch) {
      const year = Number(yearMatch[1]);
      scored.push({
        score: 4,
        priority: 0,
        result: {
          kind: 'year',
          year,
          label: strings.searchGoToYear(formatYear(year)),
          meta: '',
        },
      });
    }

    // Territories of the shown snapshot: one result per name, largest first.
    const seen = new Set<string>();
    const labels = this.collection ? territoryLabels(this.collection) : [];
    for (const label of labels) {
      if (seen.has(label.name)) continue;
      const gloss = glossName(label.name, localeCode);
      const score = Math.max(matchScore(label.name, q), gloss ? matchScore(gloss, q) : 0);
      if (score === 0) continue;
      seen.add(label.name);
      scored.push({
        score,
        priority: 1,
        result: {
          kind: 'territory',
          name: label.name,
          featureIndex: label.index,
          label: gloss ?? label.name,
          meta: gloss ? label.name : '',
        },
      });
    }

    for (const period of PERIODS) {
      const score = Math.max(matchScore(period.name[localeCode], q), matchScore(period.name.en, q));
      if (score === 0) continue;
      scored.push({
        score,
        priority: 2,
        result: {
          kind: 'chapter',
          period,
          label: period.name[localeCode],
          meta: this.periodRange(period),
        },
      });
    }

    for (const event of EVENTS) {
      if (!this.eventsById.has(event.id)) continue;
      const score = Math.max(matchScore(event.name[localeCode], q), matchScore(event.name.en, q));
      if (score === 0) continue;
      scored.push({
        score,
        priority: 3,
        result: {
          kind: 'event',
          event,
          label: event.name[localeCode],
          meta: formatYear(event.year),
        },
      });
    }

    // Names the dataset has in other years only. Capped separately so a
    // common word does not bury the other kinds under hundreds of entries.
    let otherYears = 0;
    for (const [name, years] of index) {
      if (seen.has(name) || name.length < 2) continue;
      const gloss = glossName(name, localeCode);
      const score = Math.max(matchScore(name, q), gloss ? matchScore(gloss, q) : 0);
      if (score === 0) continue;
      otherYears += 1;
      if (otherYears > SEARCH_LIMIT) break;
      scored.push({
        score,
        priority: 4,
        result: {
          kind: 'territory-years',
          name,
          years,
          label: gloss ?? name,
          meta: strings.searchTerritoryYears(
            formatYearShort(years[0]),
            formatYearShort(years[years.length - 1]),
            years.length,
          ),
        },
      });
    }

    scored.sort(
      (a, b) =>
        b.score - a.score ||
        a.priority - b.priority ||
        a.result.label.length - b.result.label.length ||
        a.result.label.localeCompare(b.result.label, strings.localeTag),
    );
    void currentYear;
    return scored.slice(0, SEARCH_LIMIT).map((entry) => entry.result);
  }

  private searchPick(result: SearchResult): void {
    // Whatever was open belongs to the previous question.
    this.map.closePopup();
    switch (result.kind) {
      case 'year':
        if (this.activePeriod) this.exitChapter();
        this.timeline.jumpToYear(result.year);
        return;

      case 'chapter':
        this.enterChapter(result.period);
        return;

      case 'territory': {
        if (this.activePeriod) this.exitChapter();
        const label = this.labelFor(result.featureIndex);
        this.map.select(result.featureIndex);
        this.handleSelect(result.featureIndex);
        if (label) this.map.flyToBounds(label.bbox);
        return;
      }

      case 'territory-years': {
        if (this.activePeriod) this.exitChapter();
        // The snapshot nearest to the one shown, so the jump is as small as
        // the dataset allows; ties go to the later year.
        const currentYear = this.snapshots[this.currentIndex].year;
        let bestYear = result.years[0];
        for (const year of result.years) {
          if (Math.abs(year - currentYear) <= Math.abs(bestYear - currentYear)) bestYear = year;
        }
        const index = this.snapshots.findIndex((snapshot) => snapshot.year === bestYear);
        if (index === -1) return;
        const name = result.name;
        this.afterLoad = () => {
          const found = this.collection
            ? territoryLabels(this.collection).find((label) => label.name === name)
            : undefined;
          if (!found) {
            this.showTransient(strings.searchNotInLoadedSnapshot(result.label, formatYear(bestYear)));
            return;
          }
          this.map.select(found.index);
          this.handleSelect(found.index);
          this.map.flyToBounds(found.bbox);
          this.showTransient(strings.searchJumpedToYear(result.label, formatYear(bestYear)));
        };
        if (index === this.currentIndex) {
          const run = this.afterLoad;
          this.afterLoad = null;
          run();
        } else {
          this.timeline.setIndex(index);
        }
        return;
      }

      case 'event': {
        if (this.activePeriod) this.exitChapter();
        const event = result.event;
        const index = this.snapshots.findIndex((snapshot) => snapshot.year >= event.year);
        if (index === -1) return;
        if (!this.eventsOpen) {
          this.eventsOpen = true;
          try {
            window.localStorage.setItem(EVENTS_OPEN_KEY, '1');
          } catch {
            /* fine */
          }
        }
        const open = () => {
          this.map.flyToPoint([event.lon, event.lat]);
          this.handleEventsClick([event.id], [event.lon, event.lat]);
        };
        if (index === this.currentIndex) {
          this.refreshEvents();
          open();
        } else {
          if (this.snapshots[index].year !== event.year) {
            this.pendingNotice = strings.eventYearShown(
              formatYear(event.year),
              formatYear(this.snapshots[index].year),
            );
          }
          this.afterLoad = open;
          this.timeline.setIndex(index);
        }
        return;
      }
    }
  }

  private labelFor(featureIndex: number): TerritoryLabel | undefined {
    if (!this.collection) return undefined;
    return territoryLabels(this.collection).find((label) => label.index === featureIndex);
  }

  private setStatus(message: string | null, isError = false): void {
    if (this.noticeTimer !== null) {
      window.clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
    this.statusNode.hidden = message === null;
    this.statusNode.textContent = message ?? '';
    this.statusNode.classList.toggle('status--error', isError);
  }

  /** An informational status that goes away on its own. */
  private showTransient(message: string): void {
    this.setStatus(message);
    this.noticeTimer = window.setTimeout(() => this.setStatus(null), 7000);
  }

  /* --------------------------------------------------------- navigation */

  private async goTo(index: number): Promise<void> {
    const snapshot = this.snapshots[index];
    if (!snapshot) return;

    this.currentIndex = index;
    const token = ++this.loadToken;

    this.clearSelection();
    this.map.closePopup();
    this.updateDisclaimer(snapshot.year);
    this.updateBasemapDefault(snapshot.year);
    this.refreshFacts();
    this.refreshEvents();
    this.updateChapterBadge();

    const url = new URL(window.location.href);
    url.searchParams.set('year', String(snapshot.year));
    window.history.replaceState(null, '', url);

    this.setStatus(strings.loadingSnapshot(formatYear(snapshot.year)));
    this.featuresNode.textContent = '';

    try {
      const collection = await loadSnapshot(snapshot);
      if (token !== this.loadToken) return; // superseded by a later selection

      this.collection = collection;
      this.map.setData(collection);
      this.publishLabels();
      if (this.pendingNotice) {
        this.showTransient(this.pendingNotice);
        this.pendingNotice = null;
      } else {
        this.setStatus(null);
      }
      this.featuresNode.textContent = strings.featureCount(
        formatCount(collection.features.length),
      );
    } catch (error) {
      if (token !== this.loadToken) return;
      console.error(error);
      this.collection = null;
      this.map.clearData();
      this.map.clearLabelsData();
      this.afterLoad = null;
      // No borders are better than borrowed ones: the map goes empty and says so.
      this.setStatus(strings.loadError(formatYear(snapshot.year)), true);
    }

    if (token !== this.loadToken) return;
    prefetchSnapshot(this.snapshots[index - 1]);
    prefetchSnapshot(this.snapshots[index + 1]);

    const continuation = this.afterLoad;
    this.afterLoad = null;
    if (continuation && this.collection) continuation();
  }

  private updateDisclaimer(year: number): void {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISCLAIMER_DISMISSED_KEY) === '1';
    } catch {
      /* storage unavailable; show the banner */
    }
    this.disclaimerNode.hidden = dismissed || year > WESTPHALIA;
  }

  private updateBasemapDefault(year: number): void {
    this.updateBasemapDefaultHint(year);
    if (this.basemapManual) return;
    this.setBasemap(year >= BASEMAP_AUTO_HIDE_BEFORE);
  }

  private updateBasemapDefaultHint(year: number): void {
    const showHint = year < BASEMAP_AUTO_HIDE_BEFORE;
    this.basemapHintNode.hidden = !showHint;
    this.basemapHintNode.textContent = showHint ? strings.basemapHintAncient : '';
  }

  /* ------------------------------------------------------------- panel */

  /** Click: pin this territory so it survives the pointer moving away. */
  private handleSelect(featureIndex: number | null): void {
    this.cancelHoverClose();

    if (featureIndex === null) {
      this.clearSelection();
      return;
    }
    const feature = this.collection?.features[featureIndex];
    if (!feature) return;

    this.pinnedFeatureIndex = featureIndex;
    this.previewFeatureIndex = null;
    this.map.setSpotlight(null);
    this.panel.show(feature, this.snapshots[this.currentIndex], 'pinned');
    this.panel.setOpen(true);
  }

  /**
   * Hover: show the same record the click shows, without committing to it.
   * A pinned territory wins — otherwise the panel would slide out from under
   * someone who deliberately clicked it and then moved to read it.
   */
  private handleHover(featureIndex: number | null): void {
    if (this.pinnedFeatureIndex !== null) return;

    if (featureIndex === null) {
      this.scheduleHoverClose();
      return;
    }

    this.cancelHoverClose();
    const feature = this.collection?.features[featureIndex];
    if (!feature) return;

    this.previewFeatureIndex = featureIndex;
    this.panel.show(feature, this.snapshots[this.currentIndex], 'preview');
    this.panel.setOpen(true);
  }

  private clearSelection(): void {
    this.cancelHoverClose();
    this.pinnedFeatureIndex = null;
    this.previewFeatureIndex = null;
    this.map.select(null);
    this.map.setSpotlight(null);
    this.panel.setOpen(false);
    this.panel.showEmpty();
  }

  private scheduleHoverClose(): void {
    this.cancelHoverClose();
    this.hoverCloseTimer = window.setTimeout(() => {
      this.hoverCloseTimer = null;
      if (this.pinnedFeatureIndex !== null) return;
      this.previewFeatureIndex = null;
      this.panel.setOpen(false);
      this.panel.showEmpty();
    }, HOVER_CLOSE_DELAY_MS);
  }

  private cancelHoverClose(): void {
    if (this.hoverCloseTimer === null) return;
    window.clearTimeout(this.hoverCloseTimer);
    this.hoverCloseTimer = null;
  }
}

/* -------------------------------------------------------------- bootstrap */

setLocale(resolveInitialLocale());
applyStaticStrings();

loadManifest()
  .then((manifest) => {
    new App(manifest);
  })
  .catch((error) => {
    console.error(error);
    const status = document.querySelector<HTMLElement>('#status');
    if (status) {
      status.hidden = false;
      status.classList.add('status--error');
      status.textContent = strings.manifestLoadError;
    }
  });
