import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

// MapLibre v6 locates its web worker relative to `import.meta.url`, which does
// not survive bundling — the worker then fails to start and no GeoJSON is ever
// tiled, leaving a blank map. Hand it a URL Vite has actually emitted.
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(maplibreWorkerUrl);

import { loadManifest, loadSnapshot, prefetchSnapshot } from './data';
import { formatCount, formatYear } from './format';
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

  private collection: SnapshotCollection | null = null;
  private currentIndex = 0;
  /** Set once the user touches the basemap toggle; suppresses the auto default. */
  private basemapManual = false;
  /** Guards against a slow snapshot landing after the user moved on. */
  private loadToken = 0;
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
      },
    );

    this.panel = new DetailPanel(requireElement('#panel'), () => this.clearSelection());

    const requested = indexFromLocation(this.snapshots);
    const initialIndex = requested.index ?? this.snapshots.length - 1;

    this.timeline = new Timeline(requireElement('#timeline'), this.snapshots, {
      onChange: (index) => void this.goTo(index),
    });

    this.bindChrome();
    this.renderFooter();
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
    requireElement('#reset-view').setAttribute('title', strings.resetViewTitle);

    requireElement('#disclaimer-dismiss').addEventListener('click', () => {
      try {
        window.sessionStorage.setItem(DISCLAIMER_DISMISSED_KEY, '1');
      } catch {
        /* private mode: the banner simply reappears next time */
      }
      this.disclaimerNode.hidden = true;
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

    const snapshot = this.snapshots[this.currentIndex];
    this.setBasemap(this.map.isBasemapVisible());
    this.updateBasemapDefaultHint(snapshot.year);
    requireElement('#reset-view').setAttribute('title', strings.resetViewTitle);

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
    this.statusNode.hidden = message === null;
    this.statusNode.textContent = message ?? '';
    this.statusNode.classList.toggle('status--error', isError);
  }

  /* --------------------------------------------------------- navigation */

  private async goTo(index: number): Promise<void> {
    const snapshot = this.snapshots[index];
    if (!snapshot) return;

    this.currentIndex = index;
    const token = ++this.loadToken;

    this.clearSelection();
    this.updateDisclaimer(snapshot.year);
    this.updateBasemapDefault(snapshot.year);

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
      this.setStatus(null);
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
      status.textContent = strings.loadError(strings.loading);
    }
  });
