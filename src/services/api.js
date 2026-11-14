import {create as axiosCreate} from 'axios';

function parseBackendUrl(value) {
  if (!value) throw new Error('Add a monitoring checker URL in Settings to run a real connection check.');
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Enter a valid monitoring checker URL.'); }
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '10.0.2.2'].includes(parsed.hostname)) {
    throw new Error('Use HTTPS to protect database credentials sent to the checker.');
  }
  return parsed;
}

export function createApi(baseURL, token) {
  const parsed = parseBackendUrl(baseURL);
  return axiosCreate({
    baseURL: `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`,
    timeout: 15000,
    headers: token ? {Authorization: `Bearer ${token}`} : {},
  });
}

const safeConfig = config => ({
  host: config.host,
  port: Number(config.port) || 5432,
  database_name: config.databaseName,
  username: config.username,
  password: config.password,
  ssl_mode: config.sslMode || 'require',
});

function checkPath(value) {
  const parsed = parseBackendUrl(value);
  const path = parsed.pathname.replace(/\/$/, '');
  if (path.endsWith('/monitor/check') || path.endsWith('/api/monitor/check')) {
    return `${parsed.origin}${path}/`;
  }
  return '/api/monitor/check/';
}

export async function checkDatabase(config, backend) {
  const api = createApi(backend.url, backend.token);
  try {
    const {data} = await api.post(checkPath(backend.url), {database: safeConfig(config)});
    if (typeof data.success !== 'boolean') throw new Error('Monitoring service returned an invalid result.');
    return {
      success: data.success,
      latencyMs: data.latency_ms ?? null,
      error: data.error_code ? `Connection check failed (${data.error_code}).` : undefined,
      checkedAt: data.checked_at || new Date().toISOString(),
    };
  } catch (error) {
    if (error.response?.data?.error_code) {
      return {
        success: false,
        latencyMs: null,
        error: `Connection check failed (${error.response.data.error_code}).`,
        checkedAt: error.response.data.checked_at || new Date().toISOString(),
      };
    }
    throw new Error('Could not reach the monitoring checker. Check the endpoint URL and network connection.');
  }
}
