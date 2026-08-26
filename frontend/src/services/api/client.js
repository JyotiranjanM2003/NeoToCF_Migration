import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const client = axios.create({
  baseURL,
  withCredentials: true, // send the httpOnly refresh cookie
});

let accessToken = null;
let onUnauthorized = () => {};

export function setAccessToken(token) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshInFlight = null;

// Endpoints that must NEVER trigger a refresh-and-retry: a 401 from any of
// these is a real, final auth failure (wrong credentials, no session yet,
// or the refresh token itself is invalid/expired) — retrying would call
// /auth/refresh again, which 401s again, forever.
const NO_REFRESH_RETRY_PATHS = ['/auth/refresh', '/auth/login', '/auth/signup'];

function isNoRetryPath(url = '') {
  return NO_REFRESH_RETRY_PATHS.some((path) => url.includes(path));
}

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;

    if (response?.status === 401 && !config._retried && !isNoRetryPath(config.url)) {
      config._retried = true;
      try {
        refreshInFlight = refreshInFlight || client.post('/auth/refresh');
        const { data } = await refreshInFlight;
        refreshInFlight = null;
        setAccessToken(data.accessToken);
        config.headers.Authorization = `Bearer ${data.accessToken}`;
        return client(config);
      } catch (refreshErr) {
        refreshInFlight = null;
        onUnauthorized();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
