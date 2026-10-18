export type Theme = 'auto' | 'light' | 'dark';

const KEY = 'moneymap-theme';

/** Sets the look on the page. 'auto' follows the phone's light/dark setting. */
export function applyTheme(t: Theme = 'auto') {
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme;
  else root.dataset.theme = t;
  // Remembered here too, so the next launch starts with the right colours before the database loads.
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage can be unavailable; the setting still applies once the database loads */
  }
}

export function applySavedTheme() {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch {
    /* ignore */
  }
}
