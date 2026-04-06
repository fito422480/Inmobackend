import { SelectQueryBuilder } from 'typeorm';

export type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export type QueryDebugSnapshot = {
  label: string;
  sql: string;
  parameters: unknown[];
};

export function getCacheValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

export function setCacheValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
  maxItems: number,
) {
  if (ttlMs <= 0) {
    return;
  }

  pruneCache(cache, maxItems);
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

export function buildStableCacheKey(input: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(input)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const value = input[key];
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {}),
  );
}

export function countActiveFilters(
  input: Record<string, unknown>,
  ignoredKeys: string[] = [],
): number {
  return Object.entries(input).filter(([key, value]) => {
    return !ignoredKeys.includes(key) && value !== undefined && value !== '';
  }).length;
}

export async function measureAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const startedAt = Date.now();
  const result = await fn();
  return {
    result,
    durationMs: Date.now() - startedAt,
  };
}

export function parsePositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function captureQuerySnapshot<Entity>(
  label: string,
  qb: SelectQueryBuilder<Entity>,
): QueryDebugSnapshot {
  const [sql, parameters] = qb.getQueryAndParameters();
  return {
    label,
    sql: sql.replace(/\s+/g, ' ').trim(),
    parameters,
  };
}

function pruneCache<T>(cache: Map<string, CacheEntry<T>>, maxItems: number) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }

  while (cache.size >= maxItems) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) {
      break;
    }
    cache.delete(firstKey);
  }
}
