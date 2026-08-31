import type { HistEvent } from './events';
import { formatCount, formatYear, formatYearShort } from './format';
import type { Period } from './periods';
import { localeCode, strings } from './strings';

/**
 * The milestone axis shown while a chapter is open.
 *
 * Unlike the main slider — which is ordinal, one stop per dataset snapshot —
 * this axis is linear in real time: its left edge is the chapter's first year,
 * its right edge the last, and its marks are milestones at their exact years.
 * It never claims borders for those years; selecting a milestone shows the
 * nearest following snapshot, and the chapter header names it.
 */

const PLAY_INTERVAL_MS = 2600;

export interface ChapterAxisCallbacks {
  onMilestone: (index: number) => void;
}

export class ChapterAxis {
  private readonly callbacks: ChapterAxisCallbacks;

  private readonly trackNode: HTMLElement;
  private readonly fillNode: HTMLElement;
  private readonly startNode: HTMLElement;
  private readonly endNode: HTMLElement;
  private readonly readoutNode: HTMLElement;
  private readonly positionNode: HTMLElement;
  private readonly previousButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly playButton: HTMLButtonElement;

  private period: Period | null = null;
  private milestones: HistEvent[] = [];
  private index = 0;
  private playTimer: number | null = null;

  constructor(root: HTMLElement, callbacks: ChapterAxisCallbacks) {
    this.callbacks = callbacks;

    this.trackNode = root.querySelector<HTMLElement>('#chapter-track')!;
    this.fillNode = root.querySelector<HTMLElement>('#chapter-fill')!;
    this.startNode = root.querySelector<HTMLElement>('#chapter-start')!;
    this.endNode = root.querySelector<HTMLElement>('#chapter-end')!;
    this.readoutNode = root.querySelector<HTMLElement>('#chapter-milestone')!;
    this.positionNode = root.querySelector<HTMLElement>('#chapter-milestone-position')!;
    this.previousButton = root.querySelector<HTMLButtonElement>('#chapter-prev')!;
    this.nextButton = root.querySelector<HTMLButtonElement>('#chapter-next')!;
    this.playButton = root.querySelector<HTMLButtonElement>('#chapter-play')!;

    this.previousButton.addEventListener('click', () => {
      this.stop();
      this.select(this.index - 1);
    });
    this.nextButton.addEventListener('click', () => {
      this.stop();
      this.select(this.index + 1);
    });
    this.playButton.addEventListener('click', () => this.togglePlay());
  }

  /** Opens the axis for a chapter. Milestones must be sorted by year. */
  setPeriod(period: Period, milestones: HistEvent[]): void {
    this.stop();
    this.period = period;
    this.milestones = milestones;
    this.index = 0;
    this.buildMarks();
    this.render();
  }

  clear(): void {
    this.stop();
    this.period = null;
    this.milestones = [];
  }

  /** Position of a year on the linear axis, in percent. */
  private positionOf(year: number): number {
    if (!this.period) return 0;
    const span = this.period.end - this.period.start;
    if (span <= 0) return 0;
    const clamped = Math.min(this.period.end, Math.max(this.period.start, year));
    return ((clamped - this.period.start) / span) * 100;
  }

  private buildMarks(): void {
    for (const mark of this.trackNode.querySelectorAll('.chmark')) mark.remove();
    this.milestones.forEach((event, index) => {
      const mark = document.createElement('button');
      mark.type = 'button';
      mark.className = 'chmark';
      mark.style.left = `${this.positionOf(event.year)}%`;
      const label = `${formatYear(event.year)}: ${event.name[localeCode]}`;
      mark.title = label;
      mark.setAttribute('aria-label', label);
      mark.dataset.index = String(index);
      mark.addEventListener('click', () => {
        this.stop();
        this.select(index);
      });
      this.trackNode.append(mark);
    });
  }

  private render(): void {
    if (!this.period) return;
    this.startNode.textContent = formatYearShort(this.period.start);
    this.endNode.textContent = formatYearShort(this.period.end);

    const current = this.milestones[this.index];
    if (current) {
      this.readoutNode.textContent = `${formatYear(current.year)} — ${current.name[localeCode]}`;
      this.positionNode.textContent = strings.chapterMilestonePosition(
        formatCount(this.index + 1),
        formatCount(this.milestones.length),
      );
      this.fillNode.style.width = `${this.positionOf(current.year)}%`;
    } else {
      this.readoutNode.textContent = '';
      this.positionNode.textContent = '';
      this.fillNode.style.width = '0%';
    }

    for (const mark of this.trackNode.querySelectorAll<HTMLElement>('.chmark')) {
      const markIndex = Number(mark.dataset.index);
      mark.classList.toggle('chmark--active', markIndex === this.index);
      mark.classList.toggle('chmark--past', markIndex < this.index);
    }

    this.previousButton.disabled = this.index === 0;
    this.nextButton.disabled = this.index >= this.milestones.length - 1;
    this.previousButton.title = strings.previousMilestone;
    this.previousButton.setAttribute('aria-label', strings.previousMilestone);
    this.nextButton.title = strings.nextMilestone;
    this.nextButton.setAttribute('aria-label', strings.nextMilestone);
    this.updatePlayButton();
  }

  private select(next: number): void {
    const clamped = Math.min(this.milestones.length - 1, Math.max(0, next));
    if (clamped === this.index) {
      this.render();
      return;
    }
    this.index = clamped;
    this.render();
    this.callbacks.onMilestone(this.index);
  }

  /** Sets the highlighted milestone without firing the callback. */
  syncIndex(index: number): void {
    this.index = Math.min(this.milestones.length - 1, Math.max(0, index));
    this.render();
  }

  get currentIndex(): number {
    return this.index;
  }

  /** Language changed: rebuild the localized mark labels and readout. */
  retranslate(): void {
    if (!this.period) return;
    this.buildMarks();
    this.render();
  }

  private togglePlay(): void {
    if (this.playTimer !== null) {
      this.stop();
      return;
    }
    if (this.index >= this.milestones.length - 1) this.select(0);
    this.playTimer = window.setInterval(() => {
      if (this.index >= this.milestones.length - 1) {
        this.stop();
        return;
      }
      this.select(this.index + 1);
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
    const label = playing ? strings.pauseChapter : strings.playChapter;
    this.playButton.setAttribute('aria-label', label);
    this.playButton.title = label;
    this.playButton.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }
}
