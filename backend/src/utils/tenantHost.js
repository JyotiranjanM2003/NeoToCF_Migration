/**
 * Tenant API clients build their own `https://` URL. Accept a hostname or a
 * pasted HTTPS URL, but store and use the canonical hostname form.
 */
function normalizeTenantHost(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  const withoutScheme = input.replace(/^https?:\/\//i, '');
  const host = withoutScheme.replace(/\/$/, '');

  if (!host || /[/?#\s]/.test(host)) {
    const error = new Error('Host must be a hostname only, for example tenant.cfapps.eu10.hana.ondemand.com');
    error.status = 400;
    throw error;
  }
  return host;
}

module.exports = { normalizeTenantHost };
