import { DERIVED_KEYS } from './data';
import { formatYear } from './format';
import { strings } from './strings';
import type { ManifestSnapshot, SnapshotFeature } from './types';

/**
 * The detail panel.
 *
 * It renders the feature's property bag and nothing else. Every value shown is
 * read straight from the dataset; absent values are reported as absent rather
 * than filled in, and the only outbound link the panel generates is an
 * explicitly labelled Wikipedia *search*, which makes no claim about what will
 * be found there.
 */

/** Documented properties, in the order the panel lists them. */
const PRIMARY_KEYS = ['NAME', 'ABBREVN', 'SUBJECTO', 'PARTOF', 'BORDERPRECISION'];

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function missingValue(): HTMLElement {
  return element('span', 'value value--missing', strings.notInDataset);
}

/** Renders one property value. Never invents, never reformats meaning. */
function renderValue(key: string, value: unknown): HTMLElement {
  if (isEmpty(value)) return missingValue();

  if (key === 'BORDERPRECISION') {
    const label =
      strings.borderPrecisionScale[String(value)] ??
      strings.borderPrecisionUndocumented(String(value));
    return element('span', 'value', label);
  }

  if (typeof value === 'string' && isUrl(value)) {
    const link = element('a', 'value value--link', value.trim());
    link.href = value.trim();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  if (typeof value === 'object') {
    return element('span', 'value value--raw', JSON.stringify(value));
  }

  return element('span', 'value', String(value));
}

function renderRow(key: string, value: unknown): HTMLElement {
  const row = element('div', 'prop');
  const label = strings.propertyLabels[key] ?? key;

  const dt = element('dt', 'prop__label', label);
  // Show the raw key alongside a friendly label so the panel stays auditable
  // against the source file.
  if (strings.propertyLabels[key]) {
    dt.append(element('span', 'prop__key', key));
  }

  const dd = element('dd', 'prop__value');
  dd.append(renderValue(key, value));

  row.append(dt, dd);
  return row;
}

export class DetailPanel {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly titleNode: HTMLElement;
  private readonly closeButton: HTMLButtonElement;

  constructor(root: HTMLElement, onClose: () => void) {
    this.root = root;
    this.root.innerHTML = '';

    const header = element('header', 'panel__header');
    this.titleNode = element('h2', 'panel__title', strings.appTitle);
    const close = element('button', 'panel__close');
    close.type = 'button';
    close.setAttribute('aria-label', strings.panelClose);
    close.textContent = '×';
    close.addEventListener('click', onClose);
    this.closeButton = close;
    header.append(this.titleNode, close);

    this.body = element('div', 'panel__body');
    this.root.append(header, this.body);
    this.showEmpty();
  }

  /** Language changed. The caller re-renders the body via show()/showEmpty(). */
  retranslate(): void {
    this.closeButton.setAttribute('aria-label', strings.panelClose);
  }

  showEmpty(): void {
    this.titleNode.textContent = strings.appTitle;
    this.body.innerHTML = '';
    this.body.append(element('p', 'panel__hint', strings.panelNoSelection));
  }

  show(feature: SnapshotFeature, snapshot: ManifestSnapshot): void {
    const properties = feature.properties ?? {};
    const rawName = properties.NAME;
    const name =
      typeof rawName === 'string' && rawName.trim() !== ''
        ? rawName.trim()
        : strings.unnamedTerritory;

    this.titleNode.textContent = name;
    this.body.innerHTML = '';

    /* ---------------------------------------------- documented properties */

    const list = element('dl', 'panel__props');
    for (const key of PRIMARY_KEYS) {
      // Only list a documented property if this file actually carries it.
      if (key in properties) list.append(renderRow(key, properties[key]));
    }
    this.body.append(element('h3', 'panel__section', strings.datasetProperties), list);

    /* --------------------------------------------------- everything else */

    const extraKeys = Object.keys(properties)
      .filter((key) => !PRIMARY_KEYS.includes(key) && !DERIVED_KEYS.has(key))
      .sort();

    if (extraKeys.length > 0) {
      const extras = element('dl', 'panel__props');
      for (const key of extraKeys) extras.append(renderRow(key, properties[key]));
      this.body.append(
        element('h3', 'panel__section', strings.otherProperties),
        extras,
      );
    }

    /* ------------------------------------------------------ provenance */

    this.body.append(
      element('h3', 'panel__section', strings.sourceHeading),
      element(
        'p',
        'panel__note',
        strings.sourceNote(snapshot.filename, formatYear(snapshot.year)),
      ),
    );

    /* -------------------------------------------------- external search */

    if (name !== strings.unnamedTerritory) {
      const search = element('a', 'panel__external');
      search.href = `https://${strings.wikipediaHost}/w/index.php?search=${encodeURIComponent(name)}`;
      search.target = '_blank';
      search.rel = 'noopener noreferrer';
      search.textContent = strings.wikipediaSearch(name);

      this.body.append(
        element('h3', 'panel__section', strings.externalHeading),
        search,
        element('p', 'panel__note panel__note--warn', strings.externalDisclaimer),
      );
    }
  }

  setOpen(open: boolean): void {
    this.root.classList.toggle('panel--open', open);
    this.root.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
}
