import { Router } from 'express';
import { getCookies, setCookies, clearCookies } from '../cookies.js';

const router = Router();

const NELLIS_BASE = 'https://www.nellisauction.com';
const DEFAULT_HEADERS = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
};

// GET /api/auth/status
router.get('/status', (_req, res) => {
  const cookies = getCookies();
  res.json({ loggedIn: Boolean(cookies) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    // Step 1: GET the login page to collect pre-auth cookies
    let initialCookies = {};
    try {
      const initRes = await fetch(`${NELLIS_BASE}/login`, {
        headers: { ...DEFAULT_HEADERS, accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
      });
      initialCookies = parseSetCookieHeaders(initRes.headers.getSetCookie?.() ?? []);
    } catch (_) {
      // Non-fatal — proceed without pre-auth cookies
    }

    // Step 2: POST credentials
    const body = new URLSearchParams({
      __rvfInternalFormId: 'login',
      email,
      password,
      rememberMe: 'on',
    });

    const loginRes = await fetch(`${NELLIS_BASE}/login?_data=routes%2Flogin`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'origin': NELLIS_BASE,
        'referer': `${NELLIS_BASE}/login`,
        'cookie': cookieMapToString(initialCookies),
      },
      body: body.toString(),
      redirect: 'manual',
    });

    // Collect all Set-Cookie from login response
    const loginCookies = parseSetCookieHeaders(loginRes.headers.getSetCookie?.() ?? []);
    const merged = { ...initialCookies, ...loginCookies };

    // Check we actually got a session cookie
    if (!merged.__session) {
      // Try to read error from body
      let detail = '';
      try { detail = await loginRes.text(); } catch (_) {}
      if (detail.includes('Invalid') || detail.includes('invalid') || detail.includes('incorrect')) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      return res.status(401).json({ error: 'Login failed — no session returned. Check credentials.' });
    }

    const cookieString = cookieMapToString(merged);
    setCookies(cookieString);

    res.json({ success: true });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  clearCookies();
  res.json({ success: true });
});

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Parse an array of Set-Cookie header strings into a name→value map.
 * Keeps only name=value, strips attributes (Path, HttpOnly, etc.)
 */
function parseSetCookieHeaders(setCookieArray) {
  const map = {};
  for (const header of setCookieArray) {
    const firstPart = header.split(';')[0].trim();
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx === -1) continue;
    const name = firstPart.slice(0, eqIdx).trim();
    const value = firstPart.slice(eqIdx + 1).trim();
    map[name] = value;
  }
  return map;
}

/**
 * Convert a cookie name→value map to a Cookie header string.
 */
function cookieMapToString(map) {
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ');
}

export default router;
