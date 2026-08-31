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
import { TerritoryMap } from './map';
import { DetailPanel } from './panel';
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
  private readonly basemapStateNode = requireElement('#basemap-state');
  private readonly basemapHintNode = requireElement('#basemap-hint');
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

  private readonly chaptersNode = requireElement('#chapters');
  private readonly chaptersStripNode = requireElement('#chapters-strip');
  private readonly chapterNode = requireElement('#chapter');
  private readonly timelineNode = requireElement('#timeline');
  private readonly chapterAxis: ChapterAxis;
  private activePeriod: Period | null = null;
  private periodMilestones: HistEvent[] = [];
  /** Milestones resolved once at start-up so broken references warn early. */
  private readonly milestonesByPeriod = new Map<string, HistEvent[]>();

  /** Hold-to-compare overlay of the newest snapshot's borders. */
  private readonly modernHoldButton = requireElement<HTMLButtonElement>('#modern-hold');
  private modernRequested = false;
  private modernPressed = false;

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
      },
      // A stale cached manifest may predate the vendored basemap. The map
      // must come up without it rather than dying in the constructor.
      resolveBasemapSources(manifest),
    );

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
    this.renderChaptersStrip();
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

    // A deep-linked chapter takes over from the plain year once the app is up.
    const periodParam = new URLSearchParams(window.location.search).get('period');
    const linkedPeriod = PERIODS.find((period) => period.id === periodParam);
    if (linkedPeriod) this.enterChapter(linkedPeriod);
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

    this.bindModernHold();

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

    window.addEventListener('resize', () => this.map.resize());
  }

  /**
   * The "Today" button: while held, today's borders — the newest snapshot of
   * the same dataset — overlay the map as an outline for comparison. The
   * snapshot is fetched on the first press, not at start-up.
   */
  private bindModernHold(): void {
    this.applyModernHoldTitle();

    const press = () => {
      if (this.modernPressed) return;
      this.modernPressed = true;
      if (!this.modernRequested) {
        this.modernRequested = true;
        void loadSnapshot(this.snapshots[this.snapshots.length - 1])
          .then((collection) => {
            this.map.setModernData(collection);
            if (this.modernPressed) this.map.setModernVisible(true);
          })
          .catch((error) => {
            console.error(error);
            this.modernRequested = false; // let a later press retry
          });
        return;
      }
      this.map.setModernVisible(true);
    };
    const release = () => {
      if (!this.modernPressed) return;
      this.modernPressed = false;
      this.map.setModernVisible(false);
    };

    const button = this.modernHoldButton;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      press();
    });
    for (const type of ['pointerup', 'pointercancel'] as const) {
      button.addEventListener(type, release);
    }
    button.addEventListener('keydown', (event) => {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
        event.preventDefault();
        press();
      }
    });
    button.addEventListener('keyup', (event) => {
      if (event.key === ' ' || event.key === 'Enter') release();
    });
    button.addEventListener('blur', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private applyModernHoldTitle(): void {
    const title = strings.modernHoldTitle(
      formatYear(this.snapshots[this.snapshots.length - 1].year),
    );
    this.modernHoldButton.title = title;
    this.modernHoldButton.setAttribute('aria-label', title);
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
    this.renderChaptersStrip();
    this.renderChapterChrome();
    this.chapterAxis.retranslate();
    this.applyModernHoldTitle();

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

  /** Renders the chapter chips, grouped by category. */
  private renderChaptersStrip(): void {
    this.chaptersStripNode.innerHTML = '';
    const categories: Array<{ key: PeriodCategory; label: string }> = [
      { key: 'war', label: strings.chapterCategoryWar },
      { key: 'discovery', label: strings.chapterCategoryDiscovery },
      { key: 'revolution', label: strings.chapterCategoryRevolution },
      { key: 'era', label: strings.chapterCategoryEra },
    ];
    for (const category of categories) {
      const periods = PERIODS.filter((period) => period.category === category.key);
      if (periods.length === 0) continue;

      const group = document.createElement('div');
      group.className = 'chapters__group';
      const label = document.createElement('span');
      label.className = 'chapters__cat';
      label.textContent = category.label;
      group.append(label);

      for (const period of periods) {
        const range = this.periodRange(period);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chapters__chip';
        chip.setAttribute('aria-label', strings.chapterOpenAria(period.name[localeCode], range));
        const name = document.createElement('span');
        name.textContent = period.name[localeCode];
        const years = document.createElement('span');
        years.className = 'chapters__chip-range';
        years.textContent = range;
        chip.append(name, years);
        chip.addEventListener('click', () => this.enterChapter(period));
        group.append(chip);
      }
      this.chaptersStripNode.append(group);
    }
  }

  private periodRange(period: Period): string {
    return `${formatYearShort(period.start)}–${formatYearShort(period.end)}`;
  }

  private enterChapter(period: Period): void {
    const milestones = this.milestonesByPeriod.get(period.id) ?? [];
    if (milestones.length === 0) {
      console.warn(`chapter "${period.id}" has no usable milestones; not opening`);
      return;
    }
    this.timeline.stop();
    this.clearSelection();
    this.activePeriod = period;
    this.periodMilestones = milestones;

    this.chaptersNode.hidden = true;
    this.timelineNode.hidden = true;
    this.chapterNode.hidden = false;

    this.renderChapterChrome();
    this.chapterAxis.setPeriod(period, milestones);
    this.map.focusBounds(period.bounds);
    this.map.setSides(
      period.sides?.map((side) => ({ names: side.territories })) ?? null,
    );

    const url = new URL(window.location.href);
    url.searchParams.set('period', period.id);
    window.history.replaceState(null, '', url);

    this.openMilestone(0);
  }

  private exitChapter(): void {
    if (!this.activePeriod) return;
    this.chapterAxis.clear();
    this.activePeriod = null;
    this.periodMilestones = [];

    this.chapterNode.hidden = true;
    this.chaptersNode.hidden = false;
    this.timelineNode.hidden = false;
    this.map.setSides(null);

    const url = new URL(window.location.href);
    url.searchParams.delete('period');
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
    this.map.showPopup(at as [number, number], root);
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
    this.basemapStateNode.textContent = visible ? strings.basemapOn : strings.basemapOff;
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
      // No borders are better than borrowed ones: the map goes empty and says so.
      this.setStatus(strings.loadError(formatYear(snapshot.year)), true);
    }

    if (token !== this.loadToken) return;
    prefetchSnapshot(this.snapshots[index - 1]);
    prefetchSnapshot(this.snapshots[index + 1]);
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
