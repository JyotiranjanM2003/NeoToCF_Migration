/**
 * Client for the SAP CPI Cloud Foundry (target) tenant.
 * Mirrors "CPI MIG010 Connect to Tenants" -> GetTargetOAuthToken + GetTargetXSRFToken.
 * (CF Cloud Controller v3 / UAA calls for cert-to-servicekey migration are
 * added in a later phase, see MIG030 in the source Postman pack.)
 */
const axios = require('axios');
const tokenCache = require('./tokenCache.service');
const encrypt = require('../utils/encrypt');
const logger = require('../utils/logger');

/**
 * POST https://{targetTokenHost}/oauth/token?grant_type=client_credentials
 * Basic auth: targetOauthId : targetOauthSecret
 */
async function fetchOAuthToken(tenant) {
  const clientSecret = encrypt.decrypt(tenant.OAUTHCLIENTSECRETENC);
  const url = `https://${tenant.TOKENHOST}/oauth/token`;

  const res = await axios.post(url, null, {
    params: { grant_type: 'client_credentials' },
    auth: { username: tenant.OAUTHCLIENTID, password: clientSecret },
  });

  return {
    accessToken: res.data.access_token,
    expiresAt: Date.now() + (res.data.expires_in ? res.data.expires_in * 1000 : 3600 * 1000),
  };
}

/** GET https://{targetHost}/api/v1/  with header X-CSRF-Token: Fetch */
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

async function ensureSession(tenant) {
  const cached = tokenCache.get(`target:${tenant.TARGETTENANTID}`);
  if (cached && !tokenCache.isExpired(cached)) {
    return cached;
  }

  const { accessToken, expiresAt } = await fetchOAuthToken(tenant);
  const { xsrfToken, cookies } = await fetchXsrfToken(tenant, accessToken);

  const session = { accessToken, expiresAt, xsrfToken, cookies };
  tokenCache.set(`target:${tenant.TARGETTENANTID}`, session);
  return session;
}

/** Quick connectivity test used by the "Connect Target" screen. */
async function testConnection(tenant) {
  try {
    await ensureSession(tenant);
    return { success: true };
  } catch (err) {
    logger.error('CF test connection failed', { message: err.message });
    return { success: false, message: err.response?.data?.error_description || err.message };
  }
}

/** Generic authenticated GET against the target CPI OData API. */
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

/**
 * Generic authenticated write (POST/PUT/DELETE) against the target CPI OData
 * API. Attaches the cached XSRF token + session cookie, per SAP's CSRF
 * protection requirement on all non-GET calls.
 */
async function write(tenant, method, path, { params = {}, data, headers = {} } = {}) {
  const session = await ensureSession(tenant);
  const res = await axios({
    method,
    url: `https://${tenant.HOST}/api/v1${path}`,
    params,
    data,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'X-CSRF-Token': session.xsrfToken,
      Cookie: session.cookies.map((c) => c.split(';')[0]).join('; '),
      ...headers,
    },
  });
  return res.data;
}

module.exports = { ensureSession, testConnection, get, write };
