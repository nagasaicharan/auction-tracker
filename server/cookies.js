import db from './db.js';

/**
 * Get the Nellis session cookies.
 * Priority: DB (set via login) → process.env.NELLIS_COOKIES
 */
export function getCookies() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'nellis_cookies'").get();
  return row?.value || process.env.NELLIS_COOKIES || null;
}

/**
 * Persist cookies to the settings table.
 */
export function setCookies(cookieString) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('nellis_cookies', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(cookieString);
}

/**
 * Clear stored cookies (logout).
 */
export function clearCookies() {
  db.prepare("DELETE FROM settings WHERE key = 'nellis_cookies'").run();
}
