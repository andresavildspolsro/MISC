import { formatCount, formatYear, formatYearShort } from './format';
import { strings } from './strings';
import type { ManifestSnapshot } from './types';

/**
 * The time axis in the bottom dock.
 *
 * The control is still indexed by *snapshot*: every stop corresponds one-to-one
 * to a file that exists, there is no interpolation and no synthetic year — a
 * year the dataset does not cover simply cannot be selected. What changed from
 * the plain ordinal slider is the *placement* of the stops: the axis is cut
 * into segments at conventional era boundaries, each segment's width follows
 * the number of snapshots it holds, and inside a segment the stops sit
 * linearly in time. So 1930, 1938 and 1945 read as close together and 1815
 * and 1880 as far apart, while antiquity is not crushed into a sliver by the
 * 123 000 BC snapshot. Era labels are drawn along the top of the track as
 * orientation only; the help card says all of this in words.
 */

/** Blank space kept between two neighbouring year labels. */
const TICK_LABEL_GAP_PX = 14;

const PLAY_INTERVAL_MS = 1600;

/**
 * Interior segment edges (years). The first and last edges are the dataset's
 * own first and last snapshot. Edges sit where the density of snapshots
 * changes, so that no segment has to hold both a millennium gap and a decade
 * gap.
 */
const SEGMENT_EDGES = [-10000, -3000, -500, 500, 1500, 1800, 1900, 1945];

/** Era bands drawn above the track: [from, to) in years, index into eraNames. */
const ERA_EDGES = [-3000, 500, 1500, 1800];

export interface TimelineCallbacks {
  onChange: (index: number) => void;
  /** Click on an event-year anchor mark under the slider. */
  onEventYear: (year: number) => void;
  /**
   * A typed year that is not a dataset year lands on the nearest snapshot.
   * This reports the substitution so the app can say it out loud — silent
   * nearest-matching is exactly what this site promises not to do.
   */
  onNearestJump: (requestedYear: number, landedIndex: number) => void;
}

interface Segment {
  from: number;
  to: number;
  /** Left edge and width on the axis, in percent. */
  left: number;
  width: number;
}

export class Timeline {
  private readonly snapshots: ManifestSnapshot[];
  private readonly callbacks: TimelineCallbacks;

  private readonly track: HTMLElement;
  private readonly bandsNode: HTMLElement;
  private readonly fillNode: HTMLElement;
  private readonly thumbNode: HTMLElement;
  private readonly playButton: HTMLButtonElement;
  private readonly previousButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly yearNode: HTMLButtonElement;
  private readonly jumpForm: HTMLFormElement;
  private readonly jumpInput: HTMLInputElement;
  private readonly jumpOptions: HTMLDataListElement;
  private readonly neighboursNode: HTMLElement;
  private readonly eraNode: HTMLElement;
  private readonly ticksNode: HTMLElement;
  private readonly eventMarksNode: HTMLElement;
  private eventYears: Array<{ year: number; names: string[] }> = [];

  private readonly segments: Segment[];
  private index = 0;
  private playTimer: number | null = null;
  private dragging = false;

  constructor(
    root: HTMLElement,
    snapshots: ManifestSnapshot[],
    callbacks: TimelineCallbacks,
  ) {
    this.snapshots = snapshots;
    this.callbacks = callbacks;

    this.track = root.querySelector<HTMLElement>('#timeline-track')!;
    this.bandsNode = root.querySelector<HTMLElement>('#timeline-bands')!;
    this.fillNode = root.querySelector<HTMLElement>('#timeline-fill')!;
    this.thumbNode = root.querySelector<HTMLElement>('#timeline-thumb')!;
    this.playButton = root.querySelector<HTMLButtonElement>('#timeline-play')!;
    this.previousButton = root.querySelector<HTMLButtonElement>('#timeline-prev')!;
    this.nextButton = root.querySelector<HTMLButtonElement>('#timeline-next')!;
    this.yearNode = root.querySelector<HTMLButtonElement>('#timeline-year')!;
    this.jumpForm = root.querySelector<HTMLFormElement>('#year-jump')!;
    this.jumpInput = root.querySelector<HTMLInputElement>('#year-jump-input')!;
    this.jumpOptions = root.querySelector<HTMLDataListElement>('#year-jump-options')!;
    this.neighboursNode = root.querySelector<HTMLElement>('#timeline-neighbours')!;
    this.eraNode = root.querySelector<HTMLElement>('#timeline-era')!;
    this.ticksNode = root.querySelector<HTMLElement>('#timeline-ticks')!;
    this.eventMarksNode = root.querySelector<HTMLElement>('#timeline-eventmarks')!;

    this.segments = this.buildSegments();
    this.track.setAttribute('role', 'slider');
    this.track.setAttribute('tabindex', '0');
    this.track.setAttribute('aria-valuemin', '0');
    this.track.setAttribute('aria-valuemax', String(snapshots.length - 1));
    this.buildBands();
    this.buildTicks();
    this.applyLabels();
    this.bindPointer();

    this.previousButton.addEventListener('click', () => {
      this.stop();
      this.setIndex(this.index - 1);
    });
    this.nextButton.addEventListener('click', () => {
      this.stop();
      this.setIndex(this.index + 1);
    });
    this.playButton.addEventListener('click', () => this.togglePlay());

    this.yearNode.addEventListener('click', () => this.openJump());
    this.jumpForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.commitJump();
    });
    this.jumpInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeJump();
    });
    this.jumpInput.addEventListener('blur', () => {
      // Give a datalist click time to land as a submit first.
      window.setTimeout(() => this.closeJump(), 150);
    });

    // Arrow keys work anywhere on the page, not only when the track has focus.
    window.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.closest('dialog[open]')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        this.stop();
        this.setIndex(this.index + (event.key === 'ArrowRight' ? 1 : -1));
      } else if (target === this.track && (event.key === 'Home' || event.key === 'End')) {
        event.preventDefault();
        this.stop();
        this.setIndex(event.key === 'Home' ? 0 : this.snapshots.length - 1);
      }
    });

    this.render();
  }

  /* ------------------------------------------------------------ geometry */

  /**
   * Cuts the axis at the era edges and gives each piece a width proportional
   * to the snapshots it holds (with a small floor so an empty piece still
   * shows). Inside a piece, years map linearly.
   */
  private buildSegments(): Segment[] {
    const first = this.snapshots[0].year;
    const last = this.snapshots[this.snapshots.length - 1].year;
    const edges = [first, ...SEGMENT_EDGES.filter((edge) => edge > first && edge < last), last];

    const counts = edges.slice(0, -1).map((from, i) => {
      const to = edges[i + 1];
      return this.snapshots.filter(
        (snapshot) => (i === 0 ? snapshot.year >= from : snapshot.year > from) && snapshot.year <= to,
      ).length;
    });
    const weights = counts.map((count) => Math.max(count, 0.75));
    const total = weights.reduce((sum, weight) => sum + weight, 0);

    let left = 0;
    return edges.slice(0, -1).map((from, i) => {
      const width = (weights[i] / total) * 100;
      const segment = { from, to: edges[i + 1], left, width };
      left += width;
      return segment;
    });
  }

  /** Position of an arbitrary year on the axis, in percent. */
  private positionOfYear(year: number): number {
    const first = this.segments[0];
    const last = this.segments[this.segments.length - 1];
    if (year <= first.from) return 0;
    if (year >= last.to) return 100;
    for (const segment of this.segments) {
      if (year > segment.from && year <= segment.to) {
        const inner = (year - segment.from) / (segment.to - segment.from);
        return segment.left + inner * segment.width;
      }
    }
    return 100;
  }

  private positionOf(index: number): number {
    return this.positionOfYear(this.snapshots[index].year);
  }

  /** Era bands along the top of the track, labelled in the active language. */
  private buildBands(): void {
    this.bandsNode.innerHTML = '';
    const first = this.snapshots[0].year;
    const last = this.snapshots[this.snapshots.length - 1].year;
    const edges = [first, ...ERA_EDGES.filter((edge) => edge > first && edge < last), last];
    for (let i = 0; i < edges.length - 1; i += 1) {
      const band = document.createElement('div');
      band.className = `timeline__band timeline__band--${i % 2}`;
      const left = this.positionOfYear(edges[i]);
      const right = this.positionOfYear(edges[i + 1]);
      band.style.left = `${left}%`;
      band.style.width = `${right - left}%`;
      band.dataset.era = String(i);
      const label = document.createElement('span');
      label.className = 'timeline__band-label';
      label.textContent = strings.eraNames[i] ?? '';
      band.title = `${strings.eraNames[i] ?? ''}: ${formatYear(edges[i])} – ${formatYear(edges[i + 1])}`;
      band.append(label);
      this.bandsNode.append(band);
    }
  }

  /* ------------------------------------------------------------- pointer */

  /**
   * Dragging or tapping anywhere on the track snaps to the nearest stop, so
   * the tightly packed decades stay reachable without aiming at a 4-pixel
   * tick. A tick's own button still wins when it is the actual target.
   */
  private bindPointer(): void {
    const pick = (clientX: number) => {
      const rect = this.track.getBoundingClientRect();
      if (rect.width === 0) return;
      const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      let best = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < this.snapshots.length; i += 1) {
        const distance = Math.abs(this.positionOf(i) - pct);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      }
      this.setIndex(best);
    };

    this.track.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.evmark')) return; // its own click handles it
      const tick = target.closest<HTMLElement>('.tick');
      event.preventDefault();
      this.stop();
      this.dragging = true;
      this.track.setPointerCapture(event.pointerId);
      this.track.classList.add('timeline__track--dragging');
      if (tick?.dataset.index !== undefined) this.setIndex(Number(tick.dataset.index));
      else pick(event.clientX);
    });
    this.track.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      pick(event.clientX);
    });
    const release = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.track.classList.remove('timeline__track--dragging');
    };
    this.track.addEventListener('pointerup', release);
    this.track.addEventListener('pointercancel', release);
  }

  /* ------------------------------------------------------------ year jump */

  private openJump(): void {
    this.stop();
    this.yearNode.hidden = true;
    this.jumpForm.hidden = false;
    this.jumpInput.value = String(this.snapshots[this.index].year);
    this.jumpInput.setAttribute('aria-invalid', 'false');
    this.jumpInput.focus();
    this.jumpInput.select();
  }

  private closeJump(): void {
    if (this.jumpForm.hidden) return;
    this.jumpForm.hidden = true;
    this.yearNode.hidden = false;
  }

  private commitJump(): void {
    const match = /^\s*(-?\d{1,6})\s*$/.exec(this.jumpInput.value);
    if (!match) {
      this.jumpInput.setAttribute('aria-invalid', 'true');
      return;
    }
    this.closeJump();
    this.jumpToYear(Number(match[1]));
  }

  /**
   * Navigates to a requested year. An exact match jumps silently; anything
   * else lands on the nearest snapshot and is reported through
   * `onNearestJump`. Ties go to the earlier year. Also used by the search box.
   */
  jumpToYear(requested: number): void {
    this.stop();
    let best = 0;
    for (let i = 1; i < this.snapshots.length; i += 1) {
      if (
        Math.abs(this.snapshots[i].year - requested) <
        Math.abs(this.snapshots[best].year - requested)
      ) {
        best = i;
      }
    }
    if (this.snapshots[best].year !== requested) {
      this.callbacks.onNearestJump(requested, best);
    }
    this.setIndex(best);
  }

  /** Re-applies every translated label. Called on start-up and on locale change. */
  private applyLabels(): void {
    this.track.setAttribute('aria-label', strings.timelineLabel);
    this.yearNode.title = strings.yearJumpTitle;
    this.yearNode.setAttribute('aria-label', strings.yearJumpTitle);
    this.jumpInput.placeholder = strings.yearJumpPlaceholder;

    // Suggestions list every real snapshot year; picking one is always exact.
    this.jumpOptions.innerHTML = '';
    for (const snapshot of this.snapshots) {
      const option = document.createElement('option');
      option.value = String(snapshot.year);
      option.label = formatYear(snapshot.year);
      this.jumpOptions.append(option);
    }

    this.previousButton.setAttribute('aria-label', strings.previousSnapshot);
    this.previousButton.title = strings.previousSnapshot;
    this.nextButton.setAttribute('aria-label', strings.nextSnapshot);
    this.nextButton.title = strings.nextSnapshot;
    this.updatePlayButton();

    for (const tick of this.ticksNode.querySelectorAll<HTMLElement>('.tick')) {
      const year = this.snapshots[Number(tick.dataset.index)]?.year;
      if (year === undefined) continue;
      tick.setAttribute('aria-label', strings.goToYear(formatYear(year)));
      tick.title = formatYear(year);
    }
  }

  /** Language changed: era suffixes, number grouping and every label move with it. */
  retranslate(): void {
    this.applyLabels();
    this.buildBands();
    this.relabelTicks();
    this.renderEventMarks();
    this.render();
  }

  private buildTicks(): void {
    this.snapshots.forEach((_snapshot, index) => {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'tick';
      tick.style.left = `${this.positionOf(index)}%`;
      tick.dataset.index = String(index);
      tick.tabIndex = -1; // the track itself is the keyboard control
      this.ticksNode.append(tick);
    });

    this.relabelTicks();
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.relabelTicks()).observe(this.ticksNode);
    }
  }

  /**
   * Anchor marks for event years. Every mark is a real, dated event from the
   * events layer; clicking one navigates to the first snapshot after it.
   */
  setEventYears(eventYears: Array<{ year: number; names: string[] }>): void {
    this.eventYears = eventYears;
    this.renderEventMarks();
  }

  private renderEventMarks(): void {
    this.eventMarksNode.innerHTML = '';
    for (const entry of this.eventYears) {
      const mark = document.createElement('button');
      mark.type = 'button';
      mark.className = 'evmark';
      mark.style.left = `${this.positionOfYear(entry.year)}%`;
      const label = strings.eventMarkerTitle(
        formatYear(entry.year),
        entry.names.join(' · ').slice(0, 120),
      );
      mark.title = label;
      mark.setAttribute('aria-label', label);
      mark.addEventListener('click', () => {
        this.stop();
        this.callbacks.onEventYear(entry.year);
      });
      this.eventMarksNode.append(mark);
    }
  }

  /**
   * Labels as many ticks as fit, then prunes by measured geometry.
   *
   * An index-based rule cannot get this right on its own: era suffixes differ
   * per language ("2000 BC" vs "2000 př. n. l.") and the two end labels are
   * edge-aligned rather than centred, so the real test is whether the boxes
   * actually touch. Every tick stays clickable and keeps its year in
   * `title`/`aria-label`; only the printed subset thins out.
   */
  private relabelTicks(): void {
    for (const label of this.ticksNode.querySelectorAll('.tick__label')) label.remove();

    const total = this.snapshots.length;
    if (total === 0) return;

    const created = this.snapshots.map((snapshot, index) => {
      const label = document.createElement('span');
      label.className =
        index === 0
          ? 'tick__label tick__label--first'
          : index === total - 1
            ? 'tick__label tick__label--last'
            : 'tick__label';
      label.style.left = `${this.positionOf(index)}%`;
      label.textContent = formatYearShort(snapshot.year);
      label.setAttribute('aria-hidden', 'true');
      this.ticksNode.append(label);
      return label;
    });

    // One layout flush, then pure reads.
    const rects = created.map((label) => label.getBoundingClientRect());

    const keep = new Set<number>([0, total - 1]);
    let lastKeptRight = rects[0].right;
    const finalLeft = rects[total - 1].left;

    for (let index = 1; index < total - 1; index += 1) {
      const rect = rects[index];
      if (rect.left < lastKeptRight + TICK_LABEL_GAP_PX) continue;
      if (rect.right > finalLeft - TICK_LABEL_GAP_PX) continue;
      keep.add(index);
      lastKeptRight = rect.right;
    }

    created.forEach((label, index) => {
      if (!keep.has(index)) label.remove();
    });
  }

  private render(): void {
    const snapshot = this.snapshots[this.index];
    const position = this.positionOf(this.index);
    this.track.setAttribute('aria-valuenow', String(this.index));
    this.track.setAttribute('aria-valuetext', formatYear(snapshot.year));
    this.thumbNode.style.left = `${position}%`;
    this.fillNode.style.width = `${position}%`;

    this.yearNode.textContent = formatYear(snapshot.year);
    this.renderNeighbours();

    this.previousButton.disabled = this.index === 0;
    this.nextButton.disabled = this.index === this.snapshots.length - 1;

    for (const tick of this.ticksNode.querySelectorAll<HTMLElement>('.tick')) {
      tick.classList.toggle('tick--active', Number(tick.dataset.index) === this.index);
    }
    for (const band of this.bandsNode.querySelectorAll<HTMLElement>('.timeline__band')) {
      const left = parseFloat(band.style.left);
      const width = parseFloat(band.style.width);
      const current = position >= left && (position < left + width || left + width >= 100);
      band.classList.toggle('timeline__band--current', current);
      // On a phone the bands are too narrow for their labels, so the current
      // era is also named beside the year.
      if (current) this.eraNode.textContent = strings.eraNames[Number(band.dataset.era)] ?? '';
    }
  }

  /**
   * The previous and next snapshot years as small step buttons beside the
   * readout, so the size of the coming jump is visible before it is made —
   * "1650 · next 1715" says more than "snapshot 37 of 53".
   */
  private renderNeighbours(): void {
    this.neighboursNode.innerHTML = '';
    this.neighboursNode.title = strings.snapshotPosition(
      formatCount(this.index + 1),
      formatCount(this.snapshots.length),
    );
    const make = (offset: -1 | 1) => {
      const target = this.snapshots[this.index + offset];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'timeline__neighbour';
      const label = offset === -1 ? strings.previousSnapshot : strings.nextSnapshot;
      button.setAttribute('aria-label', label);
      button.title = label;
      if (!target) {
        button.disabled = true;
        button.textContent = offset === -1 ? '‹ —' : '— ›';
      } else {
        button.textContent =
          offset === -1 ? `‹ ${formatYearShort(target.year)}` : `${formatYearShort(target.year)} ›`;
        button.addEventListener('click', () => {
          this.stop();
          this.setIndex(this.index + offset);
        });
      }
      return button;
    };
    this.neighboursNode.append(make(-1), make(1));
  }

  setIndex(next: number): void {
    const clamped = Math.min(this.snapshots.length - 1, Math.max(0, next));
    if (clamped === this.index) {
      this.render();
      return;
    }
    this.index = clamped;
    this.render();
    this.callbacks.onChange(this.index);
  }

  get currentIndex(): number {
    return this.index;
  }

  /**
   * Moves the slider without firing onChange — used while a chapter drives
   * navigation itself, so the hidden main timeline stays in step.
   */
  syncIndex(next: number): void {
    this.index = Math.min(this.snapshots.length - 1, Math.max(0, next));
    this.render();
  }

  /* ------------------------------------------------------------- playback */

  private togglePlay(): void {
    if (this.playTimer !== null) {
      this.stop();
    } else {
      this.start();
    }
  }

  private start(): void {
    if (this.index === this.snapshots.length - 1) this.setIndex(0);
    this.playTimer = window.setInterval(() => {
      if (this.index >= this.snapshots.length - 1) {
        this.stop();
        return;
      }
      this.setIndex(this.index + 1);
    }, PLAY_INTERVAL_MS);
    this.updatePlayButton();
  }

  stop(): void {
    if (this.playTimer === null) return;
    window.clearInterval(this.playTimer);
    this.playTimer = null;
    this.updatePlayButton();
  }

  private updatePlayButton(): void {
    const playing = this.playTimer !== null;
    this.playButton.textContent = playing ? '❚❚' : '▶';
    this.playButton.setAttribute('aria-label', playing ? strings.pause : strings.play);
    this.playButton.title = playing ? strings.pause : strings.play;
    this.playButton.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }
}
