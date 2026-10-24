import { useCallback, useEffect, useState } from 'react';

// ---------- Formatage (fr-FR) ----------
const nf = digits =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function num(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return nf(digits).format(value);
}

// Valeur avec unité, ou « — » si absente
export function withUnit(value, unit, digits = 2) {
  const v = num(value, digits);
  return v === '—' ? v : `${v} ${unit}`;
}

export function dateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeShort(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function dayShort(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function relative(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

// ---------- Dates ----------
// Les API attendent des instants ISO 8601 UTC ; les champs <input type="date"> donnent AAAA-MM-JJ.
export const todayIso = () => new Date().toISOString().slice(0, 10);

export function daysAgoIso(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Jour UTC [00:00 ; 00:00 du lendemain[
export function dayRange(dateStr) {
  const from = new Date(`${dateStr}T00:00:00Z`);
  const to = new Date(from.getTime() + 86400000);
  return { from: from.toISOString(), to: to.toISOString() };
}

// Plage de jours inclusive : du début de `start` à la fin de `end`
export function daysRange(start, end) {
  return { from: dayRange(start).from, to: dayRange(end).to };
}

export const last24h = () => {
  const to = new Date();
  return { from: new Date(to.getTime() - 86400000).toISOString(), to: to.toISOString() };
};

// ---------- Libellés des méthodes de détection (analytics-service) ----------
export const METHOD_LABELS = {
  THRESHOLD: 'Seuil Pmax',
  Z_SCORE: 'Z-score',
  POWER_VARIATION: 'Variation',
  VOLTAGE: 'Tension',
  TEMPERATURE: 'Température',
};

// Explication d'une anomalie à partir des champs renvoyés par l'API (score, limit, value)
export function explainAnomaly(a) {
  switch (a.method) {
    case 'THRESHOLD':
      return {
        observed: `${num(a.powerKw)} kW`,
        limit: `${num(a.limit)} kW`,
        text: 'Puissance supérieure au maxPowerKw du capteur',
      };
    case 'Z_SCORE':
      return {
        observed: `${num(a.powerKw)} kW`,
        limit: `|z| > ${num(a.limit)}`,
        text: `Écart inhabituel à la moyenne (z = ${num(a.score)})`,
      };
    case 'POWER_VARIATION':
      return {
        observed: `${num(a.powerKw)} kW`,
        limit: `± ${num(a.limit, 0)} %`,
        text: `${a.score > 0 ? 'Hausse' : 'Baisse'} brutale de ${num(Math.abs(a.score), 1)} % par rapport à la mesure précédente`,
      };
    case 'VOLTAGE':
      return {
        observed: `${num(a.value, 1)} V`,
        limit: `${num(a.limit, 0)} V`,
        text:
          a.value < a.limit
            ? 'Tension inférieure au minimum acceptable'
            : 'Tension supérieure au maximum acceptable',
      };
    case 'TEMPERATURE':
      return {
        observed: `${num(a.value, 1)} °C`,
        limit: `${num(a.limit, 0)} °C`,
        text: 'Température supérieure au maximum acceptable',
      };
    default:
      return { observed: `${num(a.powerKw)} kW`, limit: num(a.limit), text: a.method };
  }
}

// ---------- Chargement asynchrone ----------
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const run = useCallback(fn, deps);
  const reload = useCallback(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));
    run()
      .then(data => !cancelled && setState({ loading: false, data, error: null }))
      .catch(error => !cancelled && setState({ loading: false, data: null, error }));
    return () => {
      cancelled = true;
    };
  }, [run]);
  useEffect(() => reload(), [reload]);
  return { ...state, reload };
}
