import Fuse, { type IFuseOptions } from 'fuse.js'

/**
 * Fuse.js built-in fuzzy defaults (`Config` in fuse.mjs: threshold 0.6, distance 100).
 * This is the usual baseline for typo-tolerant list search with that library.
 *
 * Client-side search is fine for on the order of hundreds to a few thousand rows
 * (e.g. ~100+ greeting card samples). If the catalog grows much larger, prefer a
 * server-side index (e.g. PostgreSQL trigram or dedicated search) and paginated `?q=`.
 */
const DEFAULT_OPTS = {
  threshold: 0.6,
  distance: 100,
  ignoreLocation: false,
  minMatchCharLength: 1,
  includeScore: false,
} as const

/**
 * Fuzzy filter for in-memory lists (templates, greeting card samples).
 * Uses Fuse.js default fuzzy settings so behavior matches the library’s standard tuning.
 */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  keys: NonNullable<IFuseOptions<T>['keys']>
): T[] {
  const q = query.trim()
  if (!q) return [...items]
  const fuse = new Fuse(items, {
    ...DEFAULT_OPTS,
    keys,
  })
  return fuse.search(q).map((r) => r.item)
}
