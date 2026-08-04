import {
  AttributionControl,
  GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
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
import { strings } from './strings';
import type { SnapshotCollection } from './types';

const SOURCE_ID = 'snapshot';
const FILL_LAYER = 'territory-fill';
const OUTLINE_PRECISE = 'territory-outline-precise';
const OUTLINE_FUZZY = 'territory-outline-fuzzy';
const HOVER_HALO_LAYER = 'territory-hover-halo';
const HOVER_GLOW_LAYER = 'territory-hover-glow';
const HOVER_LAYER = 'territory-hover';
const SELECTED_LAYER = 'territory-selected';
const BASEMAP_LAYER = 'basemap';
const BACKGROUND_LAYER = 'background';

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
 * A neutral, label-free raster basemap. Labels are deliberately avoided: modern
 * place names printed under ancient borders are exactly the kind of anachronism
 * the dataset authors warn about.
 */
const BASEMAP_TILES = [
  'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  'https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  'https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  'https://d.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
];

const EMPTY: SnapshotCollection = { type: 'FeatureCollection', features: [] };

export interface MapCallbacks {
  /**
   * Receives the feature *index* rather than the rendered feature. MapLibre
   * tiles GeoJSON internally and may drop null-valued properties along the way;
   * the caller looks the index up in the originally parsed collection so the
   * detail panel reports the record exactly as the dataset stores it, nulls
   * included.
   */
  onSelect: (featureIndex: number | null) => void;
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

  constructor(container: HTMLElement, tooltip: HTMLElement, callbacks: MapCallbacks) {
    this.tooltip = tooltip;
    this.callbacks = callbacks;
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
    });

    this.map.touchZoomRotate.disableRotation();
    this.map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    this.map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: strings.footerBasemapAttribution,
      }),
      'bottom-right',
    );

    // Gate on `style.load`, not `load`: `load` also waits for the initial
    // basemap tiles, so an unreachable or blocked tile CDN would otherwise stop
    // the borders — the actual subject of this map — from ever being drawn.
    this.map.on('style.load', () => {
      this.ready = true;
      if (this.pendingData) {
        this.setData(this.pendingData);
        this.pendingData = null;
      }
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
        basemap: {
          type: 'raster',
          tiles: BASEMAP_TILES,
          tileSize: 256,
          maxzoom: 19,
          attribution: strings.footerBasemapAttribution,
        },
        [SOURCE_ID]: {
          type: 'geojson',
          data: EMPTY,
          // Ids come from the loader, not from a property.
          generateId: false,
        },
      },
      layers: [
        {
          id: BACKGROUND_LAYER,
          type: 'background',
          paint: { 'background-color': this.dark ? '#20201c' : '#f2f1ec' },
        },
        {
          id: BASEMAP_LAYER,
          type: 'raster',
          source: 'basemap',
          paint: {
            'raster-opacity': 1,
            // Ancient borders over a modern basemap read better when the base
            // is desaturated and does not compete with the fills.
            'raster-saturation': -0.6,
            'raster-contrast': -0.1,
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
      ],
    };
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
    this.map.on('mousemove', FILL_LAYER, (event: MapLayerMouseEvent) => {
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
      const feature = event.features?.[0];
      if (!feature || typeof feature.id !== 'number') return;
      this.select(feature.id);
      this.callbacks.onSelect(feature.id);
    });

    // A click on empty ocean clears the selection.
    this.map.on('click', (event: MapMouseEvent) => {
      const hits = this.map.queryRenderedFeatures(event.point, { layers: [FILL_LAYER] });
      if (hits.length === 0) {
        this.select(null);
        this.callbacks.onSelect(null);
      }
    });
  }

  private showTooltip(point: Point, feature: MapGeoJSONFeature): void {
    const name = feature.properties?.NAME;
    const label =
      typeof name === 'string' && name.trim() !== ''
        ? name.trim()
        : strings.unnamedTerritory;

    this.tooltip.textContent = label;
    this.tooltip.hidden = false;

    // Keep the tooltip inside the viewport near the right and bottom edges.
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

  setBasemapVisible(visible: boolean): void {
    this.basemapVisible = visible;
    if (!this.ready) {
      this.map.once('style.load', () => this.setBasemapVisible(visible));
      return;
    }
    this.map.setLayoutProperty(BASEMAP_LAYER, 'visibility', visible ? 'visible' : 'none');
  }

  isBasemapVisible(): boolean {
    return this.basemapVisible;
  }

  setDark(dark: boolean): void {
    if (this.dark === dark) return;
    this.dark = dark;
    if (!this.ready) return;

    this.map.setPaintProperty(BACKGROUND_LAYER, 'background-color', dark ? '#20201c' : '#f2f1ec');
    this.map.setPaintProperty(FILL_LAYER, 'fill-color', this.fillColorExpression());
    for (const layer of [OUTLINE_PRECISE, OUTLINE_FUZZY, HOVER_GLOW_LAYER]) {
      this.map.setPaintProperty(layer, 'line-color', this.outlineColorExpression());
    }
    this.map.setPaintProperty(HOVER_HALO_LAYER, 'line-color', this.glowColor());
    this.map.setPaintProperty(HOVER_LAYER, 'line-color', dark ? '#ffffff' : '#1a1a19');
    this.map.setPaintProperty(SELECTED_LAYER, 'line-color', dark ? '#ffd54a' : '#8a4b00');
  }

  resetView(): void {
    this.map.fitBounds(EUROPE_BOUNDS, { padding: 24, duration: 600 });
  }

  resetWorldView(): void {
    this.map.fitBounds(WORLD_BOUNDS, { padding: 12, duration: 600 });
  }

  resize(): void {
    this.map.resize();
  }
}
