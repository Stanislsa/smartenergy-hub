// Client des API existantes du projet (aucune logique métier ici : les calculs
// d'énergie et la détection d'anomalies sont faits par analytics-service).

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_TIMEOUT = 30000; // 30 secondes

async function request(url, options = {}) {
  let res;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(0, 'Délai d\'attente dépassé (timeout)');
    }
    throw new ApiError(0, 'Service injoignable');
  }
  const text = await res.text();
  // Le proxy de Vite répond 500/502/504 sans corps quand le service cible est arrêté
  if (!res.ok && !text && [500, 502, 504].includes(res.status)) {
    throw new ApiError(0, 'Service injoignable');
  }
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    if (body && typeof body === 'object') {
      const details = Array.isArray(body.details)
        ? body.details.filter(d => d !== body.message)
        : [];
      msg = body.message || body.detail || body.error || msg;
      if (details.length) msg += ` (${details.join(', ')})`;
    }
    throw new ApiError(res.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body;
}

const qs = params => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

const enc = encodeURIComponent;

export const api = {
  // --- Capteurs (MongoDB, analytics-service) ---
  sensors: (filters = {}) => request(`/api/sensors${qs(filters)}`),
  sensor: id => request(`/api/sensors/${enc(id)}`),
  createSensor: body => request('/api/sensors', { method: 'POST', body: JSON.stringify(body) }),
  dailySummary: (id, date) => request(`/api/sensors/${enc(id)}/daily-summary${qs({ date })}`),

  // --- Mesures (Cassandra, analytics-service) ---
  history: (id, from, to, limit) =>
    request(`/api/measurements/${enc(id)}${qs({ from, to, limit })}`),
  latest: id => request(`/api/measurements/${enc(id)}/latest`),

  // --- Analyses (analytics-service) ---
  summary: (id, from, to) => request(`/api/analytics/${enc(id)}/summary${qs({ from, to })}`),
  anomalies: (id, from, to) =>
    request(`/api/analytics/${enc(id)}/anomalies/all${qs({ from, to })}`),

  // --- Service IA (FastAPI) ---
  forecast: (sensorId, horizonMinutes) =>
    request('/ai/api/v1/forecasts/predict', {
      method: 'POST',
      body: JSON.stringify({ sensor_id: sensorId, horizon_minutes: horizonMinutes }),
    }),
  modelStatus: () => request('/ai/api/v1/model/status'),

  // --- Santé des services ---
  health: service => request(`/svc/${service}/health`),
};

// Exécute une requête et renvoie { ok, value, error } sans lever d'exception.
export async function settle(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}
