// Session dans sessionStorage : effacée à la fermeture de l'onglet.
const KEY = 'seh_session';

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export const getToken = () => getSession()?.accessToken || null;

export function saveSession(session) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event('auth:logout'));
}