import { cs } from './i18n/cs';
import { en } from './i18n/en';
import { es } from './i18n/es';
import type { LocaleCode, Strings } from './i18n/types';

export type { LocaleCode, Strings };

/**
 * The active UI language.
 *
 * `strings` is an ES module live binding, so every module that imports it sees
 * the new object the moment {@link setLocale} reassigns it — no listener
 * plumbing, no stale copies. Callers are still responsible for re-rendering
 * whatever they have already painted; `App.retranslate()` does that.
 *
 * Only the interface is translated. Dataset values are always rendered exactly
 * as the dataset stores them.
 */

export const LOCALES: Record<LocaleCode, Strings> = { en, cs, es };

export const LOCALE_CODES = Object.keys(LOCALES) as LocaleCode[];

const STORAGE_KEY = 'historical-map:locale';

export let strings: Strings = en;
export let localeCode: LocaleCode = 'en';

function isLocaleCode(value: string | null): value is LocaleCode {
  return value !== null && Object.prototype.hasOwnProperty.call(LOCALES, value);
}

export function setLocale(code: LocaleCode): void {
  strings = LOCALES[code];
  localeCode = code;

  document.documentElement.lang = strings.localeTag;
  document.title = strings.appTitle;

  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* private mode: the choice just will not persist */
  }
}

/**
 * Picks the starting language: an explicit `?lang=`, then a previous choice,
 * then the browser's preference, then English.
 */
export function resolveInitialLocale(): LocaleCode {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (isLocaleCode(requested)) return requested;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocaleCode(stored)) return stored;
  } catch {
    /* storage unavailable */
  }

  for (const preference of navigator.languages ?? [navigator.language]) {
    const base = preference?.split('-')[0]?.toLowerCase() ?? '';
    if (isLocaleCode(base)) return base;
  }

  return 'en';
}
