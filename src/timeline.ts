import { formatCount, formatYear, formatYearShort } from './format';
import { strings } from './strings';
import type { ManifestSnapshot } from './types';

/**
 * The time slider.
 *
 * The control is indexed by *snapshot*, not by year: its value is a position in
 * the manifest, so every stop corresponds one-to-one to a file that exists.
 * There is no interpolation and no synthetic year — a year the dataset does not
 * cover simply cannot be selected.
 *
 * Because the snapshots are unevenly spaced in time (a decade between 1930 and
 * 1938, over a hundred millennia before that) the axis is ordinal. That is
 * stated in the UI rather than left to be misread as a time axis.
 */

/** Blank space kept between two neighbouring year labels. */
const TICK_LABEL_GAP_PX = 14;

const PLAY_INTERVAL_MS = 1600;

export interface TimelineCallbacks {
  onChange: (index: number) => void;
  /**
   * A typed year that is not a dataset year lands on the nearest snapshot.
   * This reports the substitution so the app can say it out loud — silent
   * nearest-matching is exactly what this site promises not to do.
   */
  onNearestJump: (requestedYear: number, landedIndex: number) => void;
}

export class Timeline {
  private readonly snapshots: ManifestSnapshot[];
  private readonly callbacks: TimelineCallbacks;

  private readonly slider: HTMLInputElement;
  private readonly playButton: HTMLButtonElement;
  private readonly previousButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly yearNode: HTMLButtonElement;
  private readonly jumpForm: HTMLFormElement;
  private readonly jumpInput: HTMLInputElement;
  private readonly jumpOptions: HTMLDataListElement;
  private readonly positionNode: HTMLElement;
  private readonly ticksNode: HTMLElement;

  private index = 0;
  private playTimer: number | null = null;

  constructor(
    root: HTMLElement,
    snapshots: ManifestSnapshot[],
    callbacks: TimelineCallbacks,
  ) {
    this.snapshots = snapshots;
    this.callbacks = callbacks;

    this.slider = root.querySelector<HTMLInputElement>('#timeline-slider')!;
    this.playButton = root.querySelector<HTMLButtonElement>('#timeline-play')!;
    this.previousButton = root.querySelector<HTMLButtonElement>('#timeline-prev')!;
    this.nextButton = root.querySelector<HTMLButtonElement>('#timeline-next')!;
    this.yearNode = root.querySelector<HTMLButtonElement>('#timeline-year')!;
    this.jumpForm = root.querySelector<HTMLFormElement>('#year-jump')!;
    this.jumpInput = root.querySelector<HTMLInputElement>('#year-jump-input')!;
    this.jumpOptions = root.querySelector<HTMLDataListElement>('#year-jump-options')!;
    this.positionNode = root.querySelector<HTMLElement>('#timeline-position')!;
    this.ticksNode = root.querySelector<HTMLElement>('#timeline-ticks')!;

    this.slider.min = '0';
    this.slider.max = String(snapshots.length - 1);
    this.slider.step = '1';
    this.slider.value = '0';
    this.buildTicks();
    this.applyLabels();

    // A range input already moves one step per arrow key, and one step is one
    // snapshot, so keyboard navigation snaps to real years for free.
    this.slider.addEventListener('input', () => {
      this.stop();
      this.setIndex(Number(this.slider.value));
    });

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

    // Arrow keys work anywhere on the page, not only when the slider has focus.
    window.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && target !== this.slider) {
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (target === this.slider) return; // let the input handle it natively
        event.preventDefault();
        this.stop();
        this.setIndex(this.index + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });

    this.render();
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
    const requested = Number(match[1]);

    // Exact match jumps silently; anything else lands on the nearest snapshot
    // and is reported. Ties go to the earlier year.
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
    this.closeJump();
    this.setIndex(best);
  }

  /** Re-applies every translated label. Called on start-up and on locale change. */
  private applyLabels(): void {
    this.slider.setAttribute('aria-label', strings.timelineLabel);
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
    this.relabelTicks();
    this.render();
  }

  private buildTicks(): void {
    this.snapshots.forEach((_snapshot, index) => {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'tick';
      tick.style.left = `${this.positionOf(index)}%`;
      tick.dataset.index = String(index);
      tick.addEventListener('click', () => {
        this.stop();
        this.setIndex(index);
      });
      this.ticksNode.append(tick);
    });

    this.relabelTicks();
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.relabelTicks()).observe(this.ticksNode);
    }
  }

  private positionOf(index: number): number {
    const total = this.snapshots.length;
    return total === 1 ? 0 : (index / (total - 1)) * 100;
  }

  /**
   * Labels as many ticks as fit, then prunes by measured geometry.
   *
   * An index-based rule cannot get this right on its own: era suffixes differ
   * per language ("2000 BC" vs "2000 př. n. l.") and the two end labels are
   * edge-aligned rather than centred, so the real test is whether the boxes
   * actually touch. Every tick stays clickable and keeps its year in
   * `title`/`aria-label`; only the printed subset thins out, so nothing is
   * hidden from keyboard or screen-reader users.
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
    this.slider.value = String(this.index);
    this.slider.setAttribute('aria-valuetext', formatYear(snapshot.year));

    this.yearNode.textContent = formatYear(snapshot.year);
    this.positionNode.textContent = strings.snapshotPosition(
      formatCount(this.index + 1),
      formatCount(this.snapshots.length),
    );

    this.previousButton.disabled = this.index === 0;
    this.nextButton.disabled = this.index === this.snapshots.length - 1;

    for (const tick of this.ticksNode.querySelectorAll<HTMLElement>('.tick')) {
      tick.classList.toggle('tick--active', Number(tick.dataset.index) === this.index);
    }
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
