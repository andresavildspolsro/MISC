import {
  AttributionControl,
  GeoJSONSource,
  type LngLatLike,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type ExpressionSpecification,
  type LngLatBoundsLike,
  type MapGeoJSONFeature,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type Point,
  type StyleSpecification,
} from 'maplibre-gl';

import { PRECISION_KEY, SLOT_KEY } from './data';
import { palette, ungroupedColor, UNGROUPED_SLOT } from './colors';
import { glossName } from './nameGlosses';
import { localeCode, strings } from './strings';
import type { SnapshotCollection } from './types';

const SOURCE_ID = 'snapshot';
const FILL_LAYER = 'territory-fill';
const OUTLINE_PRECISE = 'territory-outline-precise';
const OUTLINE_FUZZY = 'territory-outline-fuzzy';
const HOVER_HALO_LAYER = 'territory-hover-halo';
const HOVER_GLOW_LAYER = 'territory-hover-glow';
const HOVER_LAYER = 'territory-hover';
const SELECTED_LAYER = 'territory-selected';
const LAND_LAYER = 'basemap-land';
const LAKES_LAYER = 'basemap-lakes';
const COAST_LAYER = 'basemap-coast';
const LAND_SOURCE = 'basemap-land-source';
const LAKES_SOURCE = 'basemap-lakes-source';
const BASEMAP_LAYERS = [LAND_LAYER, LAKES_LAYER, COAST_LAYER];
const EVENTS_SOURCE = 'events-source';
const EVENTS_LAYER = 'events-points';
const BACKGROUND_LAYER = 'background';
const SIDES_FILL_LAYER = 'sides-fill';
const SIDES_LINE_LAYER = 'sides-line';
const VEIL_SOURCE = 'veil-source';
const VEIL_LAYER = 'veil';
const SPOT_FILL_LAYER = 'spotlight-fill';
const SPOT_LINE_LAYER = 'spotlight-line';
const MODERN_SOURCE = 'modern-source';
const MODERN_LAYER = 'modern-outline';

/**
 * Colour pairs for chapter sides (light, dark). Purely presentational — a
 * side's tint sits on top of dataset polygons matched by NAME, never on
 * geometry of its own.
 */
const SIDE_COLORS: Array<[string, string]> = [
  ['#1d63c9', '#6ea8ff'],
  ['#c22f21', '#ff8a7a'],
  ['#6d28b8', '#c99cff'],
];

/**
 * A whole-world rectangle for the spotlight veil. Presentation only, like the
 * background layer: it dims the rendering, it does not claim any geography.
 */
const VEIL_RECT: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
        ],
      },
    },
  ],
};

/** A filter that matches nothing; used to park the spotlight layers. */
const MATCH_NOTHING: ExpressionSpecification = ['==', ['id'], -999];

/**
 * The opening view. The dataset is worldwide and is never clipped, so the map
 * opens on the whole world; Europe is one click away and is where the data is
 * most finely subdivided.
 */
export const WORLD_BOUNDS: LngLatBoundsLike = [
  [-179, -60],
  [179, 79],
];

/** Continental Europe from the Atlantic to the western approaches of the Urals. */
export const EUROPE_BOUNDS: LngLatBoundsLike = [
  [-17, 34],
  [42, 68],
];

/**
 * Zoom at which the coarse 110m coastline is swapped for the 50m one. Chosen so
 * the world view stays on the small file and the Europe view crosses over —
 * 110m is visibly chunky at continental scale.
 */
const DETAIL_ZOOM = 2;

/**
 * The basemap is drawn from Natural Earth coastlines vendored into this site,
 * not from a tile provider. That removes the API key a provider can start
 * demanding, keeps the site free of third-party runtime calls, and keeps the
 * base label-free by construction — modern place names printed under ancient
 * borders are exactly the anachronism the dataset authors warn about.
 */
export interface BasemapSources {
  coarseLand: string;
  coarseLakes: string;
  detailLand: string;
  detailLakes: string;
}

const EMPTY: SnapshotCollection = { type: 'FeatureCollection', features: [] };

/**
 * One browser click can fire several MapLibre layer listeners. The event-point
 * listeners run first and stamp the underlying DOM event; territory listeners
 * then stand down.
 */
const CONSUMED = Symbol('event-point-consumed');
function markConsumed(event: MapLayerMouseEvent | MapMouseEvent): void {
  (event.originalEvent as unknown as Record<symbol, boolean>)[CONSUMED] = true;
}
function isConsumed(event: MapLayerMouseEvent | MapMouseEvent): boolean {
  return Boolean((event.originalEvent as unknown as Record<symbol, boolean>)[CONSUMED]);
}

/**
 * On-map credit for the coastlines. A proper noun, deliberately not localized:
 * the attribution control is built once and would otherwise go stale when the
 * language changes. The full localized sentence lives in the footer.
 */
const BASEMAP_CREDIT = 'Natural Earth';

export interface MapCallbacks {
  /**
   * Receives the feature *index* rather than the rendered feature. MapLibre
   * tiles GeoJSON internally and may drop null-valued properties along the way;
   * the caller looks the index up in the originally parsed collection so the
   * detail panel reports the record exactly as the dataset stores it, nulls
   * included.
   */
  onSelect: (featureIndex: number | null) => void;
  /** Click on one or more event points (ids in popup order). */
  onEventsClick: (eventIds: string[], at: LngLatLike) => void;
  /** The popup went away, for any reason — user close, programmatic, new one. */
  onPopupClose?: () => void;
  /**
   * Fires when the pointer crosses into a different territory, and with `null`
   * when it leaves the map. Indices mean the same thing as in `onSelect`.
   * MapLibre emits `mousemove` continuously, but this only fires on an actual
   * change, so the panel re-renders once per border crossed rather than per
   * pixel moved.
   */
  onHover: (featureIndex: number | null) => void;
}

export class TerritoryMap {
  private readonly map: MapLibreMap;
  private readonly tooltip: HTMLElement;
  private readonly callbacks: MapCallbacks;

  private ready = false;
  private pendingData: SnapshotCollection | null = null;
  private hoveredId: number | null = null;
  private selectedId: number | null = null;
  private dark = false;
  private basemapVisible = true;
  private popup: Popup | null = null;
  private readonly basemap: BasemapSources | null;
  /** Set once the finer coastline has been requested, so it is fetched once. */
  private detailRequested = false;
  /** Chapter sides currently tinted, kept for dark-mode repaints. */
  private sides: Array<{ names: string[] }> | null = null;
  /** Feature ids currently spotlit (everything else is veiled), or null. */
  private spotlightIds: number[] | null = null;
  private modernVisible = false;

  constructor(
    container: HTMLElement,
    tooltip: HTMLElement,
    callbacks: MapCallbacks,
    basemap: BasemapSources | null,
  ) {
    this.tooltip = tooltip;
    this.callbacks = callbacks;
    this.basemap = basemap;
    this.dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    this.map = new MapLibreMap({
      container,
      style: this.buildStyle(),
      bounds: WORLD_BOUNDS,
      fitBoundsOptions: { padding: 12 },
      maxZoom: 10,
      minZoom: 0,
      // World copies stay on. With them off, MapLibre clamps the zoom so that
      // one world fills the viewport width, and on a wide, short map panel that
      // crops the southern hemisphere out of the default view. Seeing every
      // mapped territory at a glance matters more than the wrapped copies that
      // appear beside it.
      renderWorldCopies: true,
      dragRotate: false,
      // Arrow keys step through snapshots (see src/timeline.ts); MapLibre's own
      // keyboard panning would swallow them.
      keyboard: false,
      // The dataset is EPSG:4326 and is meant to be read as a flat basemap;
      // rotation would only make the borders harder to compare.
      pitchWithRotate: false,
      attributionControl: false,
      // MapLibre's own control tooltips would otherwise stay English.
      locale: {
        'Map.Title': strings.mapAriaLabel,
        'NavigationControl.ZoomIn': strings.zoomIn,
        'NavigationControl.ZoomOut': strings.zoomOut,
        'AttributionControl.ToggleAttribution': strings.toggleAttribution,
        'Popup.Close': strings.panelClose,
      },
    });

    // Read-only debug handle for automated browser verification (Playwright
    // scripts call queryRenderedFeatures through it). Not part of the app API.
    (window as unknown as { __map?: MapLibreMap }).__map = this.map;

    this.map.touchZoomRotate.disableRotation();
    this.map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    this.map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: BASEMAP_CREDIT,
      }),
      'bottom-right',
    );

    // Gate on `style.load`, not `load`: `load` also waits for the initial
    // basemap tiles, so an unreachable or blocked tile CDN would otherwise stop
    // the borders — the actual subject of this map — from ever being drawn.
    this.map.on('style.load', () => {
      this.ready = true;
      if (this.basemap) {
        void this.loadBasemap(this.basemap.coarseLand, this.basemap.coarseLakes);
      }
      if (this.pendingData) {
        this.setData(this.pendingData);
        this.pendingData = null;
      }
    });

    // The finer coastline is worth its 2.4 MB only once someone zooms in.
    this.map.on('zoomend', () => {
      if (!this.basemap || this.detailRequested || this.map.getZoom() < DETAIL_ZOOM) return;
      this.detailRequested = true;
      void this.loadBasemap(this.basemap.detailLand, this.basemap.detailLakes);
    });

    this.bindInteractions();

    // The map fills a flex child whose height settles only after the timeline
    // and footer have laid out; without this the canvas keeps its first,
    // slightly short size and leaves a gap.
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.map.resize()).observe(container);
    }
  }

  /* ------------------------------------------------------------------ style */

  private buildStyle(): StyleSpecification {
    return {
      version: 8,
      // No glyphs or sprite are declared: this map draws no text, so it needs
      // neither, and avoids depending on a third-party font server.
      sources: {
        [LAND_SOURCE]: {
          type: 'geojson',
          data: EMPTY,
          attribution: BASEMAP_CREDIT,
        },
        [LAKES_SOURCE]: { type: 'geojson', data: EMPTY },
        [EVENTS_SOURCE]: { type: 'geojson', data: EMPTY },
        [VEIL_SOURCE]: { type: 'geojson', data: VEIL_RECT },
        [MODERN_SOURCE]: { type: 'geojson', data: EMPTY, tolerance: 0.15 },
        [SOURCE_ID]: {
          type: 'geojson',
          data: EMPTY,
          // Ids come from the loader, not from a property.
          generateId: false,
          // MapLibre tiles GeoJSON through geojson-vt, which simplifies each
          // tile at a default tolerance of 0.375. On an atlas whose subject is
          // where the lines ran, that visibly rounds them off at world zoom.
          // 0.15 recovers most of the detail; going all the way to 0.05 doubled
          // worst-case hover latency on the densest snapshot for no further
          // visible gain.
          tolerance: 0.15,
        },
      },
      layers: [
        {
          id: BACKGROUND_LAYER,
          type: 'background',
          paint: { 'background-color': this.backgroundColor() },
        },
        {
          id: LAND_LAYER,
          type: 'fill',
          source: LAND_SOURCE,
          paint: { 'fill-color': this.dark ? '#26261f' : '#efede7' },
        },
        {
          id: LAKES_LAYER,
          type: 'fill',
          source: LAKES_SOURCE,
          paint: { 'fill-color': this.waterColor() },
        },
        {
          id: COAST_LAYER,
          type: 'line',
          source: LAND_SOURCE,
          paint: {
            'line-color': this.dark ? '#43423b' : '#c2bfb6',
            'line-width': 0.8,
          },
        },
        {
          id: FILL_LAYER,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': this.fillColorExpression(),
            'fill-opacity': this.fillOpacityExpression(),
            'fill-antialias': true,
          },
        },
        {
          // Chapter sides: a translucent tint over territories matched by
          // NAME. Parked on a match-nothing filter outside chapter mode.
          id: SIDES_FILL_LAYER,
          type: 'fill',
          source: SOURCE_ID,
          filter: MATCH_NOTHING,
          paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': 0.8 },
        },
        {
          id: SIDES_LINE_LAYER,
          type: 'line',
          source: SOURCE_ID,
          filter: MATCH_NOTHING,
          paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 2.2, 'line-opacity': 1 },
        },
        {
          // Borders the dataset records as legally determined: crisp and solid.
          id: OUTLINE_PRECISE,
          type: 'line',
          source: SOURCE_ID,
          filter: ['>=', ['coalesce', ['get', PRECISION_KEY], 0], 3],
          paint: {
            'line-color': this.outlineColorExpression(),
            'line-width': 1.1,
            'line-opacity': 0.9,
          },
        },
        {
          // Approximate or unrecorded borders: dashed and faint, so that the
          // uncertainty in the data is visible rather than hidden.
          id: OUTLINE_FUZZY,
          type: 'line',
          source: SOURCE_ID,
          filter: ['<', ['coalesce', ['get', PRECISION_KEY], 0], 3],
          paint: {
            'line-color': this.outlineColorExpression(),
            'line-width': 1,
            'line-opacity': 0.55,
            'line-dasharray': [2, 2],
          },
        },
        {
          // Outermost and very faint: a contrast halo that guarantees the
          // hovered border separates from whatever it happens to border,
          // including a same-hue neighbour.
          id: HOVER_HALO_LAYER,
          type: 'line',
          source: SOURCE_ID,
          filter: ['==', ['id'], -1],
          paint: {
            'line-color': this.glowColor(),
            'line-width': ['interpolate', ['linear'], ['zoom'], 2, 13, 6, 22],
            'line-blur': ['interpolate', ['linear'], ['zoom'], 2, 9, 6, 15],
            'line-opacity': 0.3,
          },
        },
        {
          // The glow itself, in the territory's own colour. `line-blur` spreads
          // it into light rather than a second hard edge, so the hovered border
          // lights up without gaining a heavier line.
          id: HOVER_GLOW_LAYER,
          type: 'line',
          source: SOURCE_ID,
          filter: ['==', ['id'], -1],
          paint: {
            'line-color': this.fillColorExpression(),
            // Scaled by zoom: a halo sized for a whole country would swallow the
            // small territories of a dense snapshot when zoomed out.
            'line-width': ['interpolate', ['linear'], ['zoom'], 2, 9, 6, 16],
            'line-blur': ['interpolate', ['linear'], ['zoom'], 2, 5, 6, 10],
            'line-opacity': 0.9,
          },
        },
        {
          id: HOVER_LAYER,
          type: 'line',
          source: SOURCE_ID,
          filter: ['==', ['id'], -1],
          paint: {
            'line-color': this.dark ? '#ffffff' : '#1a1a19',
            'line-width': 2,
            'line-opacity': 0.85,
          },
        },
        {
          id: SELECTED_LAYER,
          type: 'line',
          source: SOURCE_ID,
          filter: ['==', ['id'], -1],
          paint: {
            'line-color': this.dark ? '#ffd54a' : '#8a4b00',
            'line-width': 2.6,
            'line-opacity': 1,
          },
        },
        {
          // The spotlight veil: greys the whole rendering while an event
          // popup is open. Its opacity is 0 unless a spotlight is active.
          id: VEIL_LAYER,
          type: 'fill',
          source: VEIL_SOURCE,
          paint: {
            'fill-color': this.dark ? '#0c0c0b' : '#f2f1ec',
            'fill-opacity': 0,
            'fill-opacity-transition': { duration: 250 },
          },
        },
        {
          // The spotlit territories, redrawn above the veil in full colour.
          id: SPOT_FILL_LAYER,
          type: 'fill',
          source: SOURCE_ID,
          filter: MATCH_NOTHING,
          paint: {
            'fill-color': this.fillColorExpression(),
            'fill-opacity': 0.85,
          },
        },
        {
          id: SPOT_LINE_LAYER,
          type: 'line',
          source: SOURCE_ID,
          filter: MATCH_NOTHING,
          paint: {
            'line-color': this.dark ? '#f4f3ee' : '#14140f',
            'line-width': 1.6,
            'line-opacity': 0.9,
          },
        },
        {
          // Today's borders (the newest dataset snapshot), shown only while
          // the hold-to-compare button is pressed.
          id: MODERN_LAYER,
          type: 'line',
          source: MODERN_SOURCE,
          paint: {
            'line-color': this.dark ? '#f4f3ee' : '#14140f',
            'line-width': 1.3,
            'line-opacity': 0,
            'line-opacity-transition': { duration: 150 },
          },
        },
        {
          // Curriculum events as tappable points, above every border layer.
          id: EVENTS_LAYER,
          type: 'circle',
          source: EVENTS_SOURCE,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4, 4, 6, 8, 9],
            'circle-color': this.dark ? '#ff7a70' : '#b3261e',
            'circle-stroke-color': this.dark ? '#1a1a19' : '#ffffff',
            'circle-stroke-width': 1.5,
            'circle-opacity': 0.95,
          },
        },
      ],
    };
  }

  private waterColor(): string {
    return this.dark ? '#0f1418' : '#d9e3ea';
  }

  /**
   * With the basemap on, the background *is* the ocean. With it off there is no
   * land to contrast against, so it falls back to a neutral surface rather than
   * pretending the whole world is sea.
   */
  private backgroundColor(): string {
    if (!this.basemapVisible) return this.dark ? '#20201c' : '#f2f1ec';
    return this.waterColor();
  }

  /** `match` on the baked slot so the palette can swap without reloading data. */
  private fillColorExpression(): ExpressionSpecification {
    const colors = palette(this.dark);
    const cases: unknown[] = ['match', ['coalesce', ['get', SLOT_KEY], UNGROUPED_SLOT]];
    colors.forEach((color, index) => {
      cases.push(index, color);
    });
    cases.push(ungroupedColor(this.dark));
    return cases as unknown as ExpressionSpecification;
  }

  /**
   * Opacity carries border precision: the less certain the dataset is, the more
   * translucent the territory, so overlapping ancient areas read as overlapping
   * rather than as a hard mosaic.
   */
  private fillOpacityExpression(): ExpressionSpecification {
    return [
      'case',
      ['boolean', ['feature-state', 'hovered'], false],
      0.85,
      ['==', ['coalesce', ['get', PRECISION_KEY], -1], -1],
      0.25,
      ['>=', ['get', PRECISION_KEY], 3],
      0.68,
      ['>=', ['get', PRECISION_KEY], 2],
      0.55,
      0.42,
    ] as unknown as ExpressionSpecification;
  }

  private outlineColorExpression(): ExpressionSpecification {
    return this.fillColorExpression();
  }

  /**
   * Colour of the faint outer separation halo.
   *
   * The hover highlight is two layers on purpose. A glow in the territory's own
   * colour is the one that actually reads as light, but only where the
   * surroundings contrast with that hue — a teal island glows nicely, a gold
   * territory on a cream basemap beside other warm fills does not. This much
   * fainter contrast halo sits underneath and guarantees separation in that
   * case, without turning the highlight into a heavy drop shadow.
   */
  private glowColor(): string {
    return this.dark ? '#ffffff' : '#241d05';
  }

  /* ----------------------------------------------------------- interaction */

  private bindInteractions(): void {
    // Event-point handlers are registered before the territory handlers on
    // purpose: MapLibre fires layer listeners in registration order, and a tap
    // on a point must not also select the territory underneath it.
    this.map.on('mousemove', EVENTS_LAYER, (event: MapLayerMouseEvent) => {
      if (!event.features?.length) return;
      markConsumed(event);
      this.map.getCanvas().style.cursor = 'pointer';
      this.setHovered(null);
      const label = event.features
        .map((feature) => String(feature.properties?.label ?? ''))
        .filter(Boolean)
        .join(' · ');
      if (label) {
        this.tooltip.textContent = label;
        this.tooltip.hidden = false;
        this.positionTooltip(event.point);
      }
    });

    this.map.on('click', EVENTS_LAYER, (event: MapLayerMouseEvent) => {
      if (!event.features?.length) return;
      markConsumed(event);
      const ids = event.features
        .map((feature) => String(feature.properties?.id ?? ''))
        .filter(Boolean);
      const geometry = event.features[0].geometry;
      const at: LngLatLike =
        geometry.type === 'Point'
          ? (geometry.coordinates as [number, number])
          : event.lngLat;
      this.callbacks.onEventsClick(ids, at);
    });

    this.map.on('mousemove', FILL_LAYER, (event: MapLayerMouseEvent) => {
      if (isConsumed(event)) return;
      const feature = event.features?.[0];
      if (!feature) return;
      this.map.getCanvas().style.cursor = 'pointer';
      this.setHovered(typeof feature.id === 'number' ? feature.id : null);
      this.showTooltip(event.point, feature);
    });

    this.map.on('mouseleave', FILL_LAYER, () => {
      this.map.getCanvas().style.cursor = '';
      this.setHovered(null);
      this.hideTooltip();
    });

    this.map.on('click', FILL_LAYER, (event: MapLayerMouseEvent) => {
      if (isConsumed(event)) return;
      const feature = event.features?.[0];
      if (!feature || typeof feature.id !== 'number') return;
      this.select(feature.id);
      this.callbacks.onSelect(feature.id);
    });

    // A click on empty ocean clears the selection.
    this.map.on('click', (event: MapMouseEvent) => {
      if (isConsumed(event)) return;
      const hits = this.map.queryRenderedFeatures(event.point, { layers: [FILL_LAYER] });
      if (hits.length === 0) {
        this.select(null);
        this.callbacks.onSelect(null);
      }
    });
  }

  private showTooltip(point: Point, feature: MapGeoJSONFeature): void {
    const name = feature.properties?.NAME;
    // The tooltip shows a curated translation of well-known names; the panel's
    // dataset record underneath always carries the verbatim value.
    const label =
      typeof name === 'string' && name.trim() !== ''
        ? (glossName(name, localeCode) ?? name.trim())
        : strings.unnamedTerritory;

    this.tooltip.textContent = label;
    this.tooltip.hidden = false;
    this.positionTooltip(point);
  }

  /** Keeps the tooltip inside the viewport near the right and bottom edges. */
  private positionTooltip(point: Point): void {
    const { width, height } = this.tooltip.getBoundingClientRect();
    const canvas = this.map.getCanvas();
    const x = Math.min(point.x + 14, canvas.clientWidth - width - 8);
    const y = Math.min(point.y + 14, canvas.clientHeight - height - 8);
    this.tooltip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  }

  private hideTooltip(): void {
    this.tooltip.hidden = true;
  }

  private setHovered(id: number | null): void {
    if (this.hoveredId === id) return;
    if (this.hoveredId !== null) {
      this.map.setFeatureState({ source: SOURCE_ID, id: this.hoveredId }, { hovered: false });
    }
    this.hoveredId = id;
    if (id !== null) {
      this.map.setFeatureState({ source: SOURCE_ID, id }, { hovered: true });
    }
    this.setHoverFilter(id ?? -1);
    this.callbacks.onHover(id);
  }

  /**
   * Fetches a coastline pair and pushes it into the basemap sources.
   *
   * Failures are swallowed on purpose: the basemap is context, not content. If
   * it cannot be fetched the borders — which are the point of this map — still
   * draw on a plain background, exactly as they do when the user turns the
   * basemap off.
   */
  private async loadBasemap(landPath: string, lakesPath: string): Promise<void> {
    const base = import.meta.env.BASE_URL;
    const fetchJson = async (p: string) => {
      const response = await fetch(`${base}${p}`);
      if (!response.ok) throw new Error(`${p}: HTTP ${response.status}`);
      return (await response.json()) as GeoJSON.FeatureCollection;
    };

    try {
      const [land, lakes] = await Promise.all([fetchJson(landPath), fetchJson(lakesPath)]);
      (this.map.getSource(LAND_SOURCE) as GeoJSONSource | undefined)?.setData(land);
      (this.map.getSource(LAKES_SOURCE) as GeoJSONSource | undefined)?.setData(lakes);
    } catch (error) {
      console.warn('basemap unavailable, drawing borders without it', error);
    }
  }

  private setHoverFilter(id: number): void {
    for (const layer of [HOVER_HALO_LAYER, HOVER_GLOW_LAYER, HOVER_LAYER]) {
      this.map.setFilter(layer, ['==', ['id'], id]);
    }
  }

  /* -------------------------------------------------------------- public API */

  get selectedFeatureId(): number | null {
    return this.selectedId;
  }

  select(id: number | null): void {
    this.selectedId = id;
    if (this.ready) {
      this.map.setFilter(SELECTED_LAYER, ['==', ['id'], id ?? -1]);
    }
  }

  setData(collection: SnapshotCollection): void {
    if (!this.ready) {
      this.pendingData = collection;
      return;
    }
    const source = this.map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(collection as GeoJSON.FeatureCollection);

    // Feature ids are per-snapshot, so selection and hover cannot carry over.
    this.hoveredId = null;
    this.selectedId = null;
    this.setHoverFilter(-1);
    this.map.setFilter(SELECTED_LAYER, ['==', ['id'], -1]);
    this.hideTooltip();
  }

  clearData(): void {
    this.setData({ type: 'FeatureCollection', features: [] });
  }

  setEventsData(collection: GeoJSON.FeatureCollection): void {
    if (!this.ready) {
      this.map.once('style.load', () => this.setEventsData(collection));
      return;
    }
    (this.map.getSource(EVENTS_SOURCE) as GeoJSONSource | undefined)?.setData(collection);
  }

  clearEventsData(): void {
    this.setEventsData({ type: 'FeatureCollection', features: [] });
  }

  showPopup(at: LngLatLike, content: HTMLElement): void {
    this.closePopup();
    this.popup = new Popup({ closeButton: true, maxWidth: '340px', offset: 10 })
      .setLngLat(at)
      .setDOMContent(content)
      .addTo(this.map);
    this.popup.on('close', () => this.callbacks.onPopupClose?.());
  }

  closePopup(): void {
    this.popup?.remove();
    this.popup = null;
  }

  setBasemapVisible(visible: boolean): void {
    this.basemapVisible = visible;
    if (!this.ready) {
      this.map.once('style.load', () => this.setBasemapVisible(visible));
      return;
    }
    for (const layer of BASEMAP_LAYERS) {
      this.map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
    }
    this.map.setPaintProperty(BACKGROUND_LAYER, 'background-color', this.backgroundColor());
  }

  isBasemapVisible(): boolean {
    return this.basemapVisible;
  }

  setDark(dark: boolean): void {
    if (this.dark === dark) return;
    this.dark = dark;
    if (!this.ready) return;

    this.map.setPaintProperty(BACKGROUND_LAYER, 'background-color', this.backgroundColor());
    this.map.setPaintProperty(LAND_LAYER, 'fill-color', dark ? '#26261f' : '#efede7');
    this.map.setPaintProperty(LAKES_LAYER, 'fill-color', this.waterColor());
    this.map.setPaintProperty(COAST_LAYER, 'line-color', dark ? '#43423b' : '#c2bfb6');
    this.map.setPaintProperty(FILL_LAYER, 'fill-color', this.fillColorExpression());
    for (const layer of [OUTLINE_PRECISE, OUTLINE_FUZZY, HOVER_GLOW_LAYER]) {
      this.map.setPaintProperty(layer, 'line-color', this.outlineColorExpression());
    }
    this.map.setPaintProperty(HOVER_HALO_LAYER, 'line-color', this.glowColor());
    this.map.setPaintProperty(HOVER_LAYER, 'line-color', dark ? '#ffffff' : '#1a1a19');
    this.map.setPaintProperty(SELECTED_LAYER, 'line-color', dark ? '#ffd54a' : '#8a4b00');
    this.map.setPaintProperty(EVENTS_LAYER, 'circle-color', dark ? '#ff7a70' : '#b3261e');
    this.map.setPaintProperty(EVENTS_LAYER, 'circle-stroke-color', dark ? '#1a1a19' : '#ffffff');
    this.map.setPaintProperty(VEIL_LAYER, 'fill-color', dark ? '#0c0c0b' : '#f2f1ec');
    this.map.setPaintProperty(SPOT_FILL_LAYER, 'fill-color', this.fillColorExpression());
    this.map.setPaintProperty(SPOT_LINE_LAYER, 'line-color', dark ? '#f4f3ee' : '#14140f');
    this.map.setPaintProperty(MODERN_LAYER, 'line-color', dark ? '#f4f3ee' : '#14140f');
    this.applySides();
  }

  /* ------------------------------------------------- chapter sides tint */

  /** Colour of side `index` in the current theme. */
  static sideColor(index: number, dark: boolean): string {
    const pair = SIDE_COLORS[index % SIDE_COLORS.length];
    return dark ? pair[1] : pair[0];
  }

  /**
   * Tints territories by conflict side. Each side is a list of dataset NAME
   * values; anything unmatched stays untinted. Pass null to clear.
   */
  setSides(sides: Array<{ names: string[] }> | null): void {
    this.sides = sides;
    if (!this.ready) {
      this.map.once('style.load', () => this.applySides());
      return;
    }
    this.applySides();
  }

  private applySides(): void {
    if (!this.ready) return;
    if (!this.sides || this.sides.length === 0) {
      this.map.setFilter(SIDES_FILL_LAYER, MATCH_NOTHING);
      this.map.setFilter(SIDES_LINE_LAYER, MATCH_NOTHING);
      return;
    }
    const cases: unknown[] = ['match', ['get', 'NAME']];
    const allNames: string[] = [];
    this.sides.forEach((side, index) => {
      if (side.names.length === 0) return;
      cases.push(side.names, TerritoryMap.sideColor(index, this.dark));
      allNames.push(...side.names);
    });
    cases.push('rgba(0,0,0,0)');
    const color = cases as unknown as ExpressionSpecification;
    const filter: ExpressionSpecification = [
      'in',
      ['get', 'NAME'],
      ['literal', allNames],
    ];
    this.map.setFilter(SIDES_FILL_LAYER, filter);
    this.map.setPaintProperty(SIDES_FILL_LAYER, 'fill-color', color);
    this.map.setFilter(SIDES_LINE_LAYER, filter);
    this.map.setPaintProperty(SIDES_LINE_LAYER, 'line-color', color);
  }

  /* ------------------------------------------------------- spotlight veil */

  /**
   * Spotlights the given feature ids: everything else fades behind a veil.
   * The spotlit features are redrawn above it in full colour. Null clears.
   */
  setSpotlight(ids: number[] | null): void {
    this.spotlightIds = ids;
    if (!this.ready) return;
    const active = ids !== null && ids.length > 0;
    this.map.setPaintProperty(VEIL_LAYER, 'fill-opacity', active ? 0.6 : 0);
    const filter: ExpressionSpecification = active
      ? (['in', ['id'], ['literal', ids]] as unknown as ExpressionSpecification)
      : MATCH_NOTHING;
    this.map.setFilter(SPOT_FILL_LAYER, filter);
    this.map.setFilter(SPOT_LINE_LAYER, filter);
  }

  hasSpotlight(): boolean {
    return this.spotlightIds !== null && this.spotlightIds.length > 0;
  }

  /* --------------------------------------------------- modern comparison */

  /** Data for the hold-to-compare overlay: the newest dataset snapshot. */
  setModernData(collection: SnapshotCollection): void {
    if (!this.ready) {
      this.map.once('style.load', () => this.setModernData(collection));
      return;
    }
    (this.map.getSource(MODERN_SOURCE) as GeoJSONSource).setData(collection);
  }

  setModernVisible(visible: boolean): void {
    this.modernVisible = visible;
    if (!this.ready) return;
    this.map.setPaintProperty(MODERN_LAYER, 'line-opacity', visible ? 0.8 : 0);
  }

  isModernVisible(): boolean {
    return this.modernVisible;
  }

  /**
   * Re-applies translated text on map chrome after a language switch. MapLibre
   * reads its locale once at construction, so the control buttons and the
   * canvas label are patched directly.
   */
  retranslate(): void {
    const container = this.map.getContainer();
    const patch = (selector: string, label: string) => {
      const node = container.querySelector<HTMLElement>(selector);
      if (!node) return;
      node.setAttribute('aria-label', label);
      if (node.tagName === 'BUTTON') node.setAttribute('title', label);
    };
    patch('.maplibregl-ctrl-zoom-in', strings.zoomIn);
    patch('.maplibregl-ctrl-zoom-out', strings.zoomOut);
    patch('.maplibregl-ctrl-attrib-button', strings.toggleAttribution);
    this.map.getCanvas().setAttribute('aria-label', strings.mapAriaLabel);
  }

  resetView(): void {
    this.map.fitBounds(EUROPE_BOUNDS, { padding: 24, duration: 600 });
  }

  resetWorldView(): void {
    this.map.fitBounds(WORLD_BOUNDS, { padding: 12, duration: 600 });
  }

  /** Frames a chapter's bounding box. */
  focusBounds(bounds: [[number, number], [number, number]]): void {
    this.map.fitBounds(bounds, { padding: 40, duration: 800 });
  }

  resize(): void {
    this.map.resize();
  }
}
