import { useCallback, useEffect, useState } from 'react';
import { getCache, setCache, invalidateCache } from '../utils/resourceCache.js';
import * as tenantApi from '../services/api/tenant.api';
import * as packageApi from '../services/api/package.api';
import * as datastoreApi from '../services/api/datastoreMigration.api';
import * as variableApi from '../services/api/variableMigration.api';
import * as numberRangeApi from '../services/api/numberRange.api';
import * as securityApi from '../services/api/securityMigration.api';
import * as migrationReportApi from '../services/api/migrationReport.api';

/**
 * One definition of "what content types exist", shared by the Dashboard
 * coverage table and the sidebar counters so the two can never disagree.
 *
 * cacheKey matches the key each list page already uses, so loading the
 * dashboard warms those caches — navigating to Packages / Variables /
 * Data Stores / Number Ranges afterwards paints instantly with no request.
 */
export const CONTENT_TYPES = [
  { key: 'packages', label: 'Packages', route: '/packages', cacheKey: 'packages' },
  { key: 'datastores', label: 'Data Stores', route: '/datastores', cacheKey: 'datastores' },
  { key: 'variables', label: 'Variables', route: '/variables', cacheKey: 'variables' },
  { key: 'security', label: 'Security Materials', route: '/security', cacheKey: 'security-categories' },
  { key: 'numberranges', label: 'Number Ranges', route: '/number-ranges', cacheKey: 'numberranges' },
];

const MIGRATED = ['MIGRATED', 'SUCCESS', 'UPDATED'];
const TTL = 3 * 60 * 1000;
const TENANT_CACHE_KEY = 'tenants';
const TENANT_TTL = 2 * 60 * 1000; // 2 minutes — short so connection-state stays fresh

function tally(rows) {
  const list = rows || [];
  return {
    total: list.length,
    migrated: list.filter((r) => MIGRATED.includes(r.migrationStatus)).length,
    failed: list.filter((r) => r.migrationStatus === 'FAILED' || r.migrationStatus === 'PARTIAL').length,
    loaded: Boolean(rows),
  };
}

/**
 * Reads whatever list data is already cached and turns it into per-type
 * counts. Cheap and synchronous — the sidebar calls this on every render
 * without triggering a single request.
 */
export function readCachedCounts() {
  const counts = {};
  for (const type of CONTENT_TYPES) {
    if (type.key === 'security') {
      const cats = getCache(type.cacheKey);
      // Security categories expose counts per category rather than rows.
      counts[type.key] = cats
        ? {
            total: cats.reduce((sum, c) => sum + (typeof c.count === 'number' ? c.count : 0), 0),
            migrated: 0,
            failed: 0,
            loaded: true,
          }
        : { total: 0, migrated: 0, failed: 0, loaded: false };
      continue;
    }
    counts[type.key] = tally(getCache(type.cacheKey));
  }
  return counts;
}

/**
 * Loads everything the Dashboard needs: selected tenants, per-content-type
 * coverage, and the recent migration runs. Every list goes through the
 * shared resourceCache, so this is cache-first and re-navigating to the
 * dashboard costs nothing.
 */
export default function useConsoleSummary() {
  const [tenants, setTenants] = useState(() => getCache(TENANT_CACHE_KEY) ?? { source: null, target: null, loaded: false });
  const [counts, setCounts] = useState(() => readCachedCounts());
  const [report, setReport] = useState(() => getCache('migration-report'));
  const [loading, setLoading] = useState(!getCache(TENANT_CACHE_KEY));
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    setError('');

    // ── Tenants (cache-first, 2-min TTL) ──────────────────────────────────
    const cachedTenants = !force && getCache(TENANT_CACHE_KEY);
    if (cachedTenants) {
      setTenants(cachedTenants);
    } else {
      setLoading(true);
      try {
        const [sourceData, targetData] = await Promise.all([
          tenantApi.listSourceTenants(),
          tenantApi.listTargetTenants(),
        ]);
        const freshTenants = {
          source: (sourceData.tenants || []).find((t) => t.selected) || null,
          target: (targetData.tenants || []).find((t) => t.selected) || null,
          sourceAll: sourceData.tenants || [],
          targetAll: targetData.tenants || [],
          loaded: true,
        };
        setCache(TENANT_CACHE_KEY, freshTenants, TENANT_TTL);
        setTenants(freshTenants);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load tenants');
        setTenants((prev) => ({ ...prev, loaded: true }));
        setLoading(false);
        return;
      }
    }

    // ── Content lists (cache-first, failures are non-fatal) ──
    const loaders = {
      packages: () => packageApi.listPackages().then((d) => d.packages),
      datastores: () => datastoreApi.listDataStores().then((d) => d.dataStores),
      variables: () => variableApi.listVariables().then((d) => d.variables),
      numberranges: () => numberRangeApi.listNumberRanges().then((d) => d.numberRanges),
      security: () => securityApi.listCategories().then((d) => d.categories),
    };

    await Promise.all(
      CONTENT_TYPES.map(async (type) => {
        if (!force) {
          const cached = getCache(type.cacheKey);
          if (cached) return;
        }
        try {
          const rows = await loaders[type.key]();
          setCache(type.cacheKey, rows, TTL);
        } catch {
          // A single content type failing (e.g. security alias not set yet)
          // shouldn't blank the whole dashboard.
        }
      })
    );
    setCounts(readCachedCounts());

    // ── Recent runs ──
    try {
      const cachedReport = !force && getCache('migration-report');
      if (cachedReport) {
        setReport(cachedReport);
      } else {
        const data = await migrationReportApi.getMigrationReport();
        setCache('migration-report', data, 2 * 60 * 1000);
        setReport(data);
      }
    } catch {
      // Report is optional context, not the point of the page.
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return { tenants, counts, report, loading, error, reload: () => { invalidateCache(TENANT_CACHE_KEY); return load(true); } };
}
