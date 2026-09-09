import type { Manifest } from './types';

/**
 * The build-time name index: every NAME value in the dataset with the list of
 * snapshot years it appears in. Lets the search find "Austria-Hungary" while
 * the map shows 2010 — and say honestly which years it exists in — without
 * loading every snapshot. Fetched once, on the first search.
 */

export type NameIndex = Map<string, number[]>;

let pending: Promise<NameIndex> | null = null;

export function loadNameIndex(manifest: Manifest): Promise<NameIndex> {
  if (pending) return pending;
  const entry = manifest.nameIndex;
  if (!entry) return Promise.resolve(new Map());

  pending = fetch(`${import.meta.env.BASE_URL}${entry.path}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`${entry.path}: HTTP ${response.status}`);
      const parsed = (await response.json()) as { names?: Record<string, number[]> };
      const index: NameIndex = new Map();
      for (const [name, years] of Object.entries(parsed.names ?? {})) {
        if (Array.isArray(years) && years.length) index.set(name, years);
      }
      return index;
    })
    .catch((error) => {
      console.warn('name index unavailable; search covers the shown snapshot only', error);
      pending = null;
      return new Map();
    });
  return pending;
}
