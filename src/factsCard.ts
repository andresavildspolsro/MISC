import { factsForYear, factText, type Fact } from './facts';
import { formatYear } from './format';
import { localeCode, strings } from './strings';

/**
 * The card that shows "interesting facts" for the current snapshot.
 *
 * Everything about its rendering is designed to keep it visually and
 * semantically distinct from the dataset panel: its own container, a permanent
 * disclaimer line, and a per-fact source link — or a warning when there is
 * none. See src/facts.ts for the rules.
 */
export class FactsCard {
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  render(year: number): void {
    const facts = factsForYear(year);
    this.root.innerHTML = '';

    const heading = document.createElement('h2');
    heading.className = 'facts__heading';
    heading.textContent = `${strings.factsHeading} — ${formatYear(year)}`;

    const disclaimer = document.createElement('p');
    disclaimer.className = 'facts__disclaimer';
    disclaimer.textContent = strings.factsDisclaimer;

    this.root.append(heading, disclaimer);

    if (facts.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'facts__empty';
      empty.textContent = strings.factsNoneForYear;
      this.root.append(empty);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'facts__list';
    for (const fact of facts) list.append(this.renderFact(fact));
    this.root.append(list);
  }

  private renderFact(fact: Fact): HTMLElement {
    const item = document.createElement('li');
    item.className = 'facts__item';

    const { text, translated } = factText(fact, localeCode);

    const body = document.createElement('p');
    body.className = 'facts__text';
    if (fact.territory) {
      const territory = document.createElement('strong');
      territory.textContent = `${fact.territory}: `;
      body.append(territory);
    }
    body.append(document.createTextNode(text));
    item.append(body);

    if (!translated) {
      const note = document.createElement('p');
      note.className = 'facts__note';
      note.textContent = strings.factsUntranslated;
      item.append(note);
    }

    const provenance = document.createElement('p');
    provenance.className = 'facts__note';
    if (fact.source) {
      const link = document.createElement('a');
      link.href = fact.source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = fact.source.label;
      provenance.append(document.createTextNode(`${strings.factsSource}: `), link);
    } else {
      provenance.classList.add('facts__note--warn');
      provenance.textContent = strings.factsUnverified;
    }
    item.append(provenance);

    return item;
  }

  setOpen(open: boolean): void {
    this.root.hidden = !open;
  }
}
