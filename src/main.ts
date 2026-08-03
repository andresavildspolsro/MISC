import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

// MapLibre v6 locates its web worker relative to `import.meta.url`, which does
// not survive bundling — the worker then fails to start and no GeoJSON is ever
// tiled, leaving a blank map. Hand it a URL Vite has actually emitted.
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(maplibreWorkerUrl);

import { loadManifest, loadSnapshot, prefetchSnapshot } from './data';
import { formatYear } from './format';
import { TerritoryMap } from './map';
import { DetailPanel } from './panel';
import { strings } from './strings';
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

  private collection: SnapshotCollection | null = null;
  private currentIndex = 0;
  /** Set once the user touches the basemap toggle; suppresses the auto default. */
  private basemapManual = false;
  /** Guards against a slow snapshot landing after the user moved on. */
  private loadToken = 0;

  constructor(manifest: Manifest) {
    this.manifest = manifest;
    this.snapshots = manifest.snapshots;

    this.map = new TerritoryMap(
      requireElement('#map'),
      requireElement('#tooltip'),
      { onSelect: (index) => this.handleSelect(index) },
    );

    this.panel = new DetailPanel(requireElement('#panel'), () => {
      this.panel.setOpen(false);
      this.map.select(null);
    });

    const requested = indexFromLocation(this.snapshots);
    const initialIndex = requested.index ?? this.snapshots.length - 1;

    this.timeline = new Timeline(requireElement('#timeline'), this.snapshots, {
      onChange: (index) => void this.goTo(index),
    });

    this.bindChrome();
    this.renderFooter();

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

    window.addEventListener('resize', () => this.map.resize());
  }

  private renderFooter(): void {
    requireElement('#footer-commit').textContent = strings.footerSnapshotCommit(
      this.manifest.generatedFrom.commit,
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

    this.panel.setOpen(false);
    this.panel.showEmpty();
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
      this.featuresNode.textContent = strings.featureCount(collection.features.length);
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
    const showHint = year < BASEMAP_AUTO_HIDE_BEFORE;
    this.basemapHintNode.hidden = !showHint;
    this.basemapHintNode.textContent = showHint ? strings.basemapHintAncient : '';

    if (this.basemapManual) return;
    this.setBasemap(year >= BASEMAP_AUTO_HIDE_BEFORE);
  }

  /* ------------------------------------------------------------- panel */

  private handleSelect(featureIndex: number | null): void {
    if (featureIndex === null || !this.collection) {
      this.panel.setOpen(false);
      this.panel.showEmpty();
      return;
    }
    const feature = this.collection.features[featureIndex];
    if (!feature) return;
    this.panel.show(feature, this.snapshots[this.currentIndex]);
    this.panel.setOpen(true);
  }
}

/* -------------------------------------------------------------- bootstrap */

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
