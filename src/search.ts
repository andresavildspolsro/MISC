import type { HistEvent } from './events';
import type { Period } from './periods';
import { strings } from './strings';

/**
 * The search box in the top bar.
 *
 * It finds four kinds of things — a territory of the shown snapshot, a
 * territory the dataset has in *other* years, an event, a chapter — plus a
 * typed year. The matching is done by the app (it owns the data); this class
 * owns the input, the result list and the keyboard handling, and never shows
 * anything the app did not return: no fuzzy guesses, no suggestions beyond
 * what the dataset and the curated layers actually contain.
 */

export type SearchResult =
  | { kind: 'territory'; name: string; featureIndex: number; label: string; meta: string }
  | { kind: 'territory-years'; name: string; years: number[]; label: string; meta: string }
  | { kind: 'event'; event: HistEvent; label: string; meta: string }
  | { kind: 'chapter'; period: Period; label: string; meta: string }
  | { kind: 'year'; year: number; label: string; meta: string };

export interface SearchCallbacks {
  query: (text: string) => Promise<SearchResult[]>;
  pick: (result: SearchResult) => void;
  /** The input gained focus: a chance to warm up the name index. */
  onFocus?: () => void;
}

const DEBOUNCE_MS = 90;

/** Lower-cased, diacritics-stripped text for matching ("Cechy" finds "Čechy"). */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Match quality of a candidate against a folded query: 3 for a prefix match,
 * 2 for a match at the start of a word, 1 for a substring, 0 for none.
 */
export function matchScore(candidate: string, foldedQuery: string): number {
  const folded = fold(candidate);
  if (!foldedQuery) return 0;
  if (folded.startsWith(foldedQuery)) return 3;
  const at = folded.indexOf(foldedQuery);
  if (at === -1) return 0;
  return /[\s\-–(/,.]/.test(folded[at - 1] ?? ' ') ? 2 : 1;
}

export class SearchBox {
  private readonly input: HTMLInputElement;
  private readonly list: HTMLElement;
  private readonly callbacks: SearchCallbacks;

  private results: SearchResult[] = [];
  private active = -1;
  private timer: number | null = null;
  private queryToken = 0;

  constructor(form: HTMLFormElement, callbacks: SearchCallbacks) {
    this.callbacks = callbacks;
    this.input = form.querySelector<HTMLInputElement>('#search-input')!;
    this.list = form.querySelector<HTMLElement>('#search-results')!;
    this.applyLabels();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.commit();
    });

    this.input.addEventListener('input', () => this.schedule());
    this.input.addEventListener('focus', () => {
      this.callbacks.onFocus?.();
      if (this.input.value.trim()) this.schedule();
    });
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (this.results.length === 0) return;
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.setActive((this.active + step + this.results.length) % this.results.length);
      } else if (event.key === 'Escape') {
        if (!this.list.hidden) {
          event.preventDefault();
          this.close();
        } else if (this.input.value) {
          this.input.value = '';
        }
      }
    });

    // Clicks land on the option; blur would otherwise close the list first.
    this.list.addEventListener('mousedown', (event) => event.preventDefault());
    this.list.addEventListener('click', (event) => {
      const option = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
      if (!option) return;
      const index = Number(option.dataset.index);
      const result = this.results[index];
      if (result) this.pick(result);
    });

    document.addEventListener('click', (event) => {
      if (!form.contains(event.target as Node)) this.close();
    });
    this.input.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (document.activeElement !== this.input) this.close();
      }, 120);
    });
  }

  retranslate(): void {
    this.applyLabels();
    if (!this.list.hidden) this.schedule();
  }

  private applyLabels(): void {
    this.input.placeholder = strings.searchPlaceholder;
    this.input.setAttribute('aria-label', strings.searchLabel);
  }

  private schedule(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.run();
    }, DEBOUNCE_MS);
  }

  private async run(): Promise<void> {
    const text = this.input.value.trim();
    const token = ++this.queryToken;
    if (!text) {
      this.close();
      return;
    }
    const results = await this.callbacks.query(text);
    if (token !== this.queryToken) return; // typed on
    this.results = results;
    this.active = results.length ? 0 : -1;
    this.render();
  }

  private render(): void {
    this.list.innerHTML = '';
    if (this.results.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'search__empty';
      empty.textContent = strings.searchNoResults;
      this.list.append(empty);
    }
    this.results.forEach((result, index) => {
      const item = document.createElement('li');
      item.className = 'search__option';
      item.id = `search-option-${index}`;
      item.setAttribute('role', 'option');
      item.dataset.index = String(index);
      item.classList.toggle('search__option--active', index === this.active);
      item.setAttribute('aria-selected', index === this.active ? 'true' : 'false');

      const kind = document.createElement('span');
      kind.className = `search__kind search__kind--${result.kind}`;
      kind.textContent = kindLabel(result);
      const label = document.createElement('span');
      label.className = 'search__label';
      label.textContent = result.label;
      const meta = document.createElement('span');
      meta.className = 'search__meta';
      meta.textContent = result.meta;
      item.append(label, meta, kind);
      this.list.append(item);
    });
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this.syncActiveDescendant();
  }

  private setActive(index: number): void {
    this.active = index;
    this.list.querySelectorAll<HTMLElement>('.search__option').forEach((node, i) => {
      node.classList.toggle('search__option--active', i === index);
      node.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    this.syncActiveDescendant();
    this.list.querySelector<HTMLElement>('.search__option--active')?.scrollIntoView({
      block: 'nearest',
    });
  }

  private syncActiveDescendant(): void {
    if (this.active >= 0) {
      this.input.setAttribute('aria-activedescendant', `search-option-${this.active}`);
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  private commit(): void {
    if (this.timer !== null) {
      // Enter arrived before the debounce fired: search now, then pick.
      window.clearTimeout(this.timer);
      this.timer = null;
      void this.run().then(() => {
        const result = this.results[Math.max(0, this.active)];
        if (result) this.pick(result);
      });
      return;
    }
    const result = this.results[Math.max(0, this.active)];
    if (result) this.pick(result);
  }

  private pick(result: SearchResult): void {
    this.close();
    this.input.value = '';
    this.input.blur();
    this.callbacks.pick(result);
  }

  private close(): void {
    this.queryToken += 1;
    this.results = [];
    this.active = -1;
    this.list.hidden = true;
    this.list.innerHTML = '';
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }
}

function kindLabel(result: SearchResult): string {
  switch (result.kind) {
    case 'territory':
      return strings.searchKindTerritory;
    case 'territory-years':
      return result.meta ? '' : strings.searchKindTerritory;
    case 'event':
      return strings.searchKindEvent;
    case 'chapter':
      return strings.searchKindChapter;
    case 'year':
      return '';
  }
}
