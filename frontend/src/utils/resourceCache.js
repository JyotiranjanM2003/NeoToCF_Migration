/**
 * Tiny in-memory cache that survives React route navigation (module-level singleton).
 *
 * Usage:
 *   import { getCache, setCache, invalidateCache, invalidateAll } from '../utils/resourceCache';
 *
 *   const hit = getCache('variables');           // null on miss or stale
 *   if (!hit) { const data = await api(); setCache('variables', data, 120_000); }
 *
 * Keys to use:
 *   'variables'    – Variables page list
 *   'datastores'   – DataStores page list
 *   'packages'     – Packages page list
 *   'numberranges' – SecurityMaterials / Number Ranges list
 *
 * Tenant selection still calls invalidateAll() so switching tenants never
 * serves stale data from a previous tenant pair.
 */

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes
let activeScope = 'anonymous';

const store = new Map(); // key → { data, expiresAt }

/** Switch the cache namespace when the authenticated account changes. */
export function setCacheScope(scope) {
  const nextScope = scope ? String(scope) : 'anonymous';
  if (nextScope === activeScope) return;
  activeScope = nextScope;
  store.clear();
}

/** Returns cached data or null if missing/stale. */
export function getCache(key) {
  const entry = store.get(key);
  if (!entry || entry.scope !== activeScope) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

/** Stores data under key for ttlMs milliseconds (default 5 min). */
export function setCache(key, data, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs, scope: activeScope });
}

/** Removes a single key so the next load re-fetches. */
export function invalidateCache(key) {
  store.delete(key);
}

/** Nukes everything — call this when the user switches source or target tenant. */
export function invalidateAll() {
  store.clear();
}
