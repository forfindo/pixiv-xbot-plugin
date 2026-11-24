import { SEARCH_PAGE_CACHE_MAX } from '../infra/constants.js';

interface CacheEntry {
  lastPage: number;
  hits: number;
  lastUsed: number;
}

export class SearchPageCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private tick = 0;

  constructor(maxEntries: number = SEARCH_PAGE_CACHE_MAX) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): number | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    entry.hits += 1;
    entry.lastUsed = ++this.tick;
    return entry.lastPage;
  }

  set(key: string, lastPage: number): void {
    const page = Number.isFinite(lastPage) ? Math.max(1, Math.floor(lastPage)) : 1;
    const existing = this.entries.get(key);
    if (existing) {
      existing.lastPage = page;
      existing.lastUsed = ++this.tick;
      return;
    }

    if (this.entries.size >= this.maxEntries) {
      this.evict();
    }
    this.entries.set(key, { lastPage: page, hits: 1, lastUsed: ++this.tick });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
    this.tick = 0;
  }

  private evict(): void {
    let victimKey: string | undefined;
    let victim: CacheEntry | undefined;

    for (const [key, entry] of this.entries) {
      if (
        !victim ||
        entry.hits < victim.hits ||
        (entry.hits === victim.hits && entry.lastUsed < victim.lastUsed)
      ) {
        victimKey = key;
        victim = entry;
      }
    }

    if (victimKey !== undefined) {
      this.entries.delete(victimKey);
    }
  }
}

export const searchPageCache = new SearchPageCache();
