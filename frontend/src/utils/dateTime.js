const INDIA_TIME_ZONE = 'Asia/Kolkata';

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return new Date(value);

  const normalized = value.trim().replace(' ', 'T');
  // HANA timestamp strings can be returned without an offset. Migration
  // timestamps are stored as UTC, so make that offset explicit before parsing.
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return new Date(hasOffset ? normalized : `${normalized}Z`);
}

/** Format an API/database timestamp consistently for Indian Standard Time. */
export function formatIndiaDateTime(value, options = {}) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...options,
  }).format(date);
}

/** Format a timestamp as an IST time only, for compact migration logs. */
export function formatIndiaTime(value, options = {}) {
  return formatIndiaDateTime(value, {
    year: undefined,
    month: undefined,
    day: undefined,
    ...options,
  });
}

export { INDIA_TIME_ZONE };
