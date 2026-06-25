import { Router } from 'express';
import { getCookies } from '../cookies.js';
import db from '../db.js';
import {
  extractLostAuctionItems,
  fetchLostAuctions,
  fetchSearchResults,
  normalizeSearchItem,
} from '../nellis.js';

const router = Router();
const LOST_PAGE_SIZE = 36;
const MAX_LOST_PAGES = 20;
const SEARCH_DELAY_MS = 3000;
const LOST_PAGE_DELAY_MS = 1000;
const MAX_MATCHES_PER_LOST_ITEM = 5;

let scanRunning = false;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ensureLoggedIn(req, res, next) {
  const cookies = getCookies();
  if (!cookies || cookies.includes('YOUR_SESSION_COOKIE_HERE')) {
    return res.status(401).json({ error: 'Not logged in — please log in first' });
  }
  req.cookies = cookies;
  return next();
}

function cleanTitle(title) {
  return String(title || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(open box|new|used|lot|auction|item)\b/gi, ' ')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');
}

function titleTokens(title) {
  const stopWords = new Set([
    'and',
    'for',
    'with',
    'the',
    'only',
    'selling',
    'parts',
    'open',
    'box',
    'new',
    'used',
  ]);
  return cleanTitle(title)
    .toLowerCase()
    .split(' ')
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function titleMatchScore(lostTitle, matchTitle) {
  const lostTokens = titleTokens(lostTitle);
  const matchTokens = new Set(titleTokens(matchTitle));
  if (!lostTokens.length || !matchTokens.size) return 0;
  const matched = lostTokens.filter((token) => matchTokens.has(token)).length;
  return matched / Math.min(lostTokens.length, 8);
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item?.id || item?.productId;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeCacheRow(row) {
  if (!row) return null;
  return {
    lostItem: parseJson(row.lost_item, null),
    search: row.search,
    matches: parseJson(row.matches, []),
    status: row.status,
    error: row.error,
    matchCount: row.match_count,
    lastCheckedAt: row.last_checked_at,
    cached: true,
    locationName: row.location_name,
  };
}

function getScanState() {
  const row = db.prepare('SELECT * FROM lost_relist_scan_state WHERE id = 1').get();
  return {
    status: scanRunning && row.status !== 'running' ? 'running' : row.status,
    locationName: row.location_name,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    totalLost: row.total_lost,
    processedCount: row.processed_count,
    matchedCount: row.matched_count,
    error: row.error,
    searchDelayMs: row.search_delay_ms,
    lostPageDelayMs: row.lost_page_delay_ms,
    updatedAt: row.updated_at,
    running: scanRunning || row.status === 'running',
  };
}

function setScanState(fields) {
  const current = db.prepare('SELECT * FROM lost_relist_scan_state WHERE id = 1').get();
  db.prepare(`
    UPDATE lost_relist_scan_state
    SET status = ?,
        location_name = ?,
        started_at = ?,
        finished_at = ?,
        total_lost = ?,
        processed_count = ?,
        matched_count = ?,
        error = ?,
        search_delay_ms = ?,
        lost_page_delay_ms = ?,
        updated_at = datetime('now')
    WHERE id = 1
  `).run(
    fields.status ?? current.status,
    fields.locationName ?? current.location_name,
    fields.startedAt ?? current.started_at,
    fields.finishedAt ?? current.finished_at,
    fields.totalLost ?? current.total_lost,
    fields.processedCount ?? current.processed_count,
    fields.matchedCount ?? current.matched_count,
    fields.error ?? current.error,
    fields.searchDelayMs ?? current.search_delay_ms,
    fields.lostPageDelayMs ?? current.lost_page_delay_ms,
  );
  return getScanState();
}

function extractTotalLost(data, fallback) {
  const total = data?.myAuctions?.total ?? data?.page?.total ?? data?.total;
  const normalized = Number(total);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function upsertCacheRow({ lostItem, locationName, search, matches = [], status = 'checked', error = null }) {
  const lostId = String(lostItem.id || lostItem.inventoryNumber || lostItem.title);
  db.prepare(`
    INSERT INTO lost_relist_cache (
      lost_id, location_name, lost_item, search, matches, status,
      error, match_count, last_checked_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(lost_id, location_name) DO UPDATE SET
      lost_item = excluded.lost_item,
      search = excluded.search,
      matches = excluded.matches,
      status = excluded.status,
      error = excluded.error,
      match_count = excluded.match_count,
      last_checked_at = excluded.last_checked_at,
      updated_at = datetime('now')
  `).run(
    lostId,
    locationName,
    JSON.stringify(lostItem),
    search,
    JSON.stringify(matches),
    status,
    error,
    matches.length,
  );
}

async function findMatchesForLostItem(cookies, lostItem, locationName) {
  const search = cleanTitle(lostItem.title);
  if (!search) return { search, matches: [] };

  const query = {
    search,
    MarketStatus: 'open',
  };
  if (locationName) query['Location Name'] = locationName;

  const result = await fetchSearchResults(cookies, query);
  const matches = uniqueById(
    (Array.isArray(result.products) ? result.products : [])
      .map((item) => normalizeSearchItem(item))
      .filter(Boolean)
      .filter((item) => item.marketStatus?.toLowerCase?.() !== 'closed' && !item.isClosed)
      .map((item) => ({ ...item, matchScore: titleMatchScore(lostItem.title, item.title) }))
      .filter((item) => item.matchScore >= 0.3)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, MAX_MATCHES_PER_LOST_ITEM),
  );

  return { search, matches };
}

async function runLostRelistScan({ cookies, locationName, maxPages = MAX_LOST_PAGES }) {
  scanRunning = true;
  let processedCount = 0;
  let matchedCount = 0;
  let totalLost = 0;

  setScanState({
    status: 'running',
    locationName,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    totalLost: 0,
    processedCount: 0,
    matchedCount: 0,
    error: null,
    searchDelayMs: SEARCH_DELAY_MS,
    lostPageDelayMs: LOST_PAGE_DELAY_MS,
  });

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const data = await fetchLostAuctions(cookies, { page, size: LOST_PAGE_SIZE });
      const lostItems = extractLostAuctionItems(data);
      totalLost = Math.max(totalLost, extractTotalLost(data, processedCount + lostItems.length));

      if (!lostItems.length) break;

      for (const lostItem of lostItems) {
        const search = cleanTitle(lostItem.title);

        try {
          await sleep(SEARCH_DELAY_MS);
          const result = await findMatchesForLostItem(cookies, lostItem, locationName);
          processedCount += 1;
          if (result.matches.length) matchedCount += 1;
          upsertCacheRow({
            lostItem,
            locationName,
            search: result.search,
            matches: result.matches,
          });
        } catch (err) {
          processedCount += 1;
          upsertCacheRow({
            lostItem,
            locationName,
            search,
            matches: [],
            status: 'error',
            error: err.message,
          });
        }

        setScanState({ totalLost, processedCount, matchedCount });
      }

      if (processedCount >= totalLost) break;
      await sleep(LOST_PAGE_DELAY_MS);
    }

    setScanState({
      status: 'completed',
      finishedAt: new Date().toISOString(),
      totalLost,
      processedCount,
      matchedCount,
      error: null,
    });
  } catch (err) {
    setScanState({
      status: 'failed',
      finishedAt: new Date().toISOString(),
      totalLost,
      processedCount,
      matchedCount,
      error: err.message,
    });
  } finally {
    scanRunning = false;
  }
}

router.get('/live-matches', ensureLoggedIn, (req, res) => {
  const locationName = typeof req.query.locationName === 'string' ? req.query.locationName.trim() : '';
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const onlyMatches = req.query.onlyMatches === '1' || req.query.onlyMatches === 'true';
  const params = { locationName, limit };

  let sql = `
    SELECT * FROM lost_relist_cache
    WHERE location_name = @locationName
  `;
  if (onlyMatches) sql += ' AND match_count > 0';
  sql += `
    ORDER BY match_count DESC, datetime(last_checked_at) DESC
    LIMIT @limit
  `;

  const rows = db.prepare(sql).all(params).map(normalizeCacheRow);

  res.json({
    rows,
    count: rows.length,
    scan: getScanState(),
    cacheOnly: true,
    returnedAt: new Date().toISOString(),
  });
});

router.get('/scan', ensureLoggedIn, (_req, res) => {
  res.json({ scan: getScanState() });
});

router.post('/scan', ensureLoggedIn, (req, res) => {
  if (scanRunning) {
    return res.status(409).json({ error: 'Lost relist scan is already running.', scan: getScanState() });
  }

  const locationName = typeof req.body?.locationName === 'string' ? req.body.locationName.trim() : '';
  const maxPages = Math.min(Math.max(Number(req.body?.maxPages) || MAX_LOST_PAGES, 1), MAX_LOST_PAGES);

  runLostRelistScan({ cookies: req.cookies, locationName, maxPages }).catch((err) => {
    console.error('Lost relist scan error:', err.message);
  });

  return res.status(202).json({ scan: getScanState() });
});

export default router;
