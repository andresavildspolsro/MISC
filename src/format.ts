import { strings } from './strings';

/**
 * Formats a dataset year for display in the active language.
 *
 * The dataset stores BC years as negative numbers, where -1 means 1 BC (there
 * is no year zero in the BC/AD reckoning and the dataset has no year-0 file).
 * We therefore never map a negative year onto "0" or shift it by one — the
 * magnitude is shown as-is with the era suffix each language uses, which is how
 * the upstream filenames (`world_bc2000.geojson`) are written.
 */
export function formatYear(year: number): string {
  return year < 0 ? strings.yearBc(magnitude(year)) : strings.yearAd(magnitude(year));
}

/** Compact form for dense timeline ticks. */
export function formatYearShort(year: number): string {
  return year < 0 ? strings.yearBc(magnitude(year)) : magnitude(year);
}

/** Grouped according to the active locale: 123,000 / 123 000 / 123.000. */
export function formatCount(value: number): string {
  return value.toLocaleString(strings.localeTag);
}

/**
 * Years are conventionally written without a thousands separator ("AD 1650",
 * not "AD 1,650"). The dataset does reach back to 123000 BC, though, where an
 * unbroken run of digits is genuinely hard to read — so grouping kicks in only
 * at five digits and above.
 */
function magnitude(year: number): string {
  const value = Math.abs(year);
  return value >= 10000 ? value.toLocaleString(strings.localeTag) : String(value);
}
