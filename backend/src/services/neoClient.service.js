/**
 * Client for the SAP CPI Neo (source) tenant.
 * Mirrors "CPI MIG010 Connect to Tenants" -> GetSourceOAuthToken + GetSourceXSRFToken.
 */
const axios = require('axios');
const tokenCache = require('./tokenCache.service');
const encrypt = require('../utils/encrypt');
const logger = require('../utils/logger');

/**
 * POST https://{sourceTokenHost}/oauth2/api/v1/token?grant_type=client_credentials
 * Basic auth: sourceOauthId : sourceOauthSecret
 */
async function fetchOAuthToken(tenant) {
  const clientSecret = encrypt.decrypt(tenant.OAUTHCLIENTSECRETENC);
  const url = `https://${tenant.TOKENHOST}/oauth2/api/v1/token`;

  const res = await axios.post(url, null, {
    params: { grant_type: 'client_credentials' },
    auth: { username: tenant.OAUTHCLIENTID, password: clientSecret },
  });

  return {
    accessToken: res.data.access_token,
    expiresAt: Date.now() + (res.data.expires_in ? res.data.expires_in * 1000 : 3600 * 1000),
  };
}

/**
 * GET https://{sourceHost}/api/v1/  with header X-CSRF-Token: Fetch
 * Returns the XSRF token + session cookie needed for POST/DELETE calls.
 */
async function fetchXsrfToken(tenant, accessToken) {
  const url = `https://${tenant.HOST}/api/v1/`;
  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-CSRF-Token': 'Fetch',
    },
  });

  return {
    xsrfToken: res.headers['x-csrf-token'],
    cookies: res.headers['set-cookie'] || [],
  };
}

/**
 * Ensures a valid, cached OAuth + XSRF token pair for this source tenant.
 * Re-fetches automatically when missing or close to expiry.
 */
async function ensureSession(tenant) {
  const cached = tokenCache.get(`source:${tenant.SOURCETENANTID}`);
  if (cached && !tokenCache.isExpired(cached)) {
    return cached;
  }

  const { accessToken, expiresAt } = await fetchOAuthToken(tenant);
  const { xsrfToken, cookies } = await fetchXsrfToken(tenant, accessToken);

  const session = { accessToken, expiresAt, xsrfToken, cookies };
  tokenCache.set(`source:${tenant.SOURCETENANTID}`, session);
  return session;
}

/** Quick connectivity test used by the "Connect Source" screen. */
async function testConnection(tenant) {
  try {
    await ensureSession(tenant);
    return { success: true };
  } catch (err) {
    logger.error('Neo test connection failed', { message: err.message });
    return { success: false, message: err.response?.data?.error_description || err.message };
  }
}

/** Generic authenticated GET against the source CPI OData API. */
async function get(tenant, path, params = {}) {
  const session = await ensureSession(tenant);
  const res = await axios.get(`https://${tenant.HOST}/api/v1${path}`, {
    params,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'application/json',
    },
  });
  return res.data;
}

/** Generic authenticated GET that returns a binary body (zip downloads). */
async function getBinary(tenant, path, params = {}) {
  const session = await ensureSession(tenant);
  const res = await axios.get(`https://${tenant.HOST}/api/v1${path}`, {
    params,
    responseType: 'arraybuffer',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
  return res.data;
}

module.exports = { ensureSession, testConnection, get, getBinary };
