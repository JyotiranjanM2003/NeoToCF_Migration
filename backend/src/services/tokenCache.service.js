/**
 * Very small in-memory cache for per-tenant OAuth + XSRF tokens, keyed by
 * tenantId. Good enough for a single-instance deployment; swap for Redis
 * once you run more than one backend instance.
 */
const store = new Map();

function set(tenantId, data) {
  store.set(tenantId, { ...data, cachedAt: Date.now() });
}

function get(tenantId) {
  return store.get(tenantId) || null;
}

function isExpired(entry, skewMs = 30000) {
  if (!entry || !entry.expiresAt) return true;
  return Date.now() + skewMs >= entry.expiresAt;
}

function clear(tenantId) {
  store.delete(tenantId);
}

module.exports = { set, get, isExpired, clear };
