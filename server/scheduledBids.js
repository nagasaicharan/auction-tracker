import db from './db.js';
import { getCookies } from './cookies.js';
import { fetchProductDetail, normalizeSearchItem, placeBid } from './nellis.js';

const BID_LEAD_TIME_MS = 29_000;
const SCHEDULER_INTERVAL_MS = 5_000;
const ACTIVE_STATUSES = new Set(['pending']);

let schedulerHandle = null;
let schedulerRunning = false;

function nowIso() {
  return new Date().toISOString();
}

function serializeResult(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseResult(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeRow(row) {
  if (!row) return null;
  const closeMs = new Date(row.close_time).getTime();
  const scheduledFor = Number.isNaN(closeMs)
    ? null
    : new Date(closeMs - BID_LEAD_TIME_MS).toISOString();

  return {
    id: row.id,
    productId: row.product_id,
    title: row.title,
    imageUrl: row.image_url,
    closeTime: row.close_time,
    scheduledFor,
    bidAmount: row.bid_amount,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    lastResult: parseResult(row.last_result),
    executedAt: row.executed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateScheduleInput({ productId, title, closeTime, bidAmount }) {
  const normalizedProductId = Number(productId);
  const normalizedBidAmount = Number(bidAmount);
  const closeDate = new Date(closeTime);

  if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
    return { error: 'productId must be a positive integer' };
  }

  if (!Number.isFinite(normalizedBidAmount) || normalizedBidAmount <= 0) {
    return { error: 'bidAmount must be a positive number' };
  }

  if (!title || typeof title !== 'string') {
    return { error: 'title is required' };
  }

  if (Number.isNaN(closeDate.getTime())) {
    return { error: 'closeTime must be a valid date' };
  }

  if (closeDate.getTime() <= Date.now()) {
    return { error: 'closeTime must be in the future' };
  }

  return {
    value: {
      productId: normalizedProductId,
      title: title.trim(),
      closeTime: closeDate.toISOString(),
      bidAmount: Number(normalizedBidAmount.toFixed(2)),
    },
  };
}

export function createScheduledBid(input) {
  const validation = validateScheduleInput(input);
  if (validation.error) {
    const err = new Error(validation.error);
    err.status = 400;
    throw err;
  }

  const { productId, title, closeTime, bidAmount } = validation.value;
  const imageUrl = input.imageUrl || input.image || null;

  const existing = db.prepare(`
    SELECT * FROM scheduled_bids
    WHERE product_id = ? AND status = 'pending'
    ORDER BY close_time ASC
    LIMIT 1
  `).get(productId);

  if (existing) {
    const row = db.prepare(`
      UPDATE scheduled_bids
      SET title = ?, image_url = ?, close_time = ?, bid_amount = ?,
          last_error = NULL, last_result = NULL, updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `).get(title, imageUrl, closeTime, bidAmount, existing.id);
    return normalizeRow(row);
  }

  const row = db.prepare(`
    INSERT INTO scheduled_bids (product_id, title, image_url, close_time, bid_amount)
    VALUES (?, ?, ?, ?, ?)
    RETURNING *
  `).get(productId, title, imageUrl, closeTime, bidAmount);

  return normalizeRow(row);
}

export function listScheduledBids({ status } = {}) {
  if (status && status !== 'all') {
    return db.prepare(`
      SELECT * FROM scheduled_bids
      WHERE status = ?
      ORDER BY
        CASE status
          WHEN 'pending' THEN 0
          WHEN 'failed' THEN 1
          WHEN 'missed' THEN 2
          WHEN 'placed' THEN 3
          ELSE 4
        END,
        close_time ASC
    `).all(status).map(normalizeRow);
  }

  return db.prepare(`
    SELECT * FROM scheduled_bids
    ORDER BY
      CASE status
        WHEN 'pending' THEN 0
        WHEN 'failed' THEN 1
        WHEN 'missed' THEN 2
        WHEN 'placed' THEN 3
        ELSE 4
      END,
      close_time ASC
  `).all().map(normalizeRow);
}

export function getScheduledBid(id) {
  const row = db.prepare('SELECT * FROM scheduled_bids WHERE id = ?').get(Number(id));
  return normalizeRow(row);
}

export function cancelScheduledBid(id) {
  const row = db.prepare(`
    UPDATE scheduled_bids
    SET status = 'cancelled', cancelled_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND status = 'pending'
    RETURNING *
  `).get(Number(id));
  return normalizeRow(row);
}

function updateScheduledBid(id, status, { lastError = null, lastResult = null, closeTime = null } = {}) {
  const result = serializeResult(lastResult);
  const executedAt = ['placed', 'failed', 'missed'].includes(status) ? nowIso() : null;

  const row = db.prepare(`
    UPDATE scheduled_bids
    SET status = ?,
        attempts = attempts + 1,
        last_error = ?,
        last_result = ?,
        close_time = COALESCE(?, close_time),
        executed_at = COALESCE(?, executed_at),
        updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `).get(status, lastError, result, closeTime, executedAt, id);

  return normalizeRow(row);
}

function refreshPendingCloseTime(id, closeTime) {
  const row = db.prepare(`
    UPDATE scheduled_bids
    SET close_time = ?, updated_at = datetime('now')
    WHERE id = ? AND status = 'pending'
    RETURNING *
  `).get(closeTime, id);
  return normalizeRow(row);
}

function markMissed(id, message) {
  return updateScheduledBid(id, 'missed', { lastError: message });
}

function getDuePendingBids() {
  const threshold = new Date(Date.now() + BID_LEAD_TIME_MS).toISOString();
  return db.prepare(`
    SELECT * FROM scheduled_bids
    WHERE status = 'pending' AND close_time <= ?
    ORDER BY close_time ASC
    LIMIT 10
  `).all(threshold);
}

async function executeScheduledBid(row) {
  const closeMs = new Date(row.close_time).getTime();
  if (Number.isNaN(closeMs)) {
    return updateScheduledBid(row.id, 'failed', { lastError: 'Invalid close time on scheduled bid.' });
  }

  if (Date.now() >= closeMs) {
    return markMissed(row.id, 'Auction closed before the scheduled bid could run.');
  }

  const cookies = getCookies();
  if (!cookies || cookies.includes('YOUR_SESSION_COOKIE_HERE')) {
    return updateScheduledBid(row.id, 'failed', { lastError: 'Not logged in to Nellis. Please log in again.' });
  }

  try {
    const detail = await fetchProductDetail(cookies, row.product_id, 'product');
    const item = normalizeSearchItem(detail?.product);

    if (!item) {
      return updateScheduledBid(row.id, 'failed', { lastError: 'Could not refresh item details before bidding.' });
    }

    const refreshedCloseTime = item.closeTime || row.close_time;
    const refreshedCloseMs = new Date(refreshedCloseTime).getTime();

    if (item.isClosed || item.marketStatus?.toLowerCase?.() === 'closed' || Date.now() >= refreshedCloseMs) {
      return markMissed(row.id, 'Auction was already closed when the scheduled bid ran.');
    }

    if (!Number.isNaN(refreshedCloseMs) && refreshedCloseMs - Date.now() > BID_LEAD_TIME_MS) {
      return refreshPendingCloseTime(row.id, refreshedCloseTime);
    }

    if (item.canBid === false) {
      return updateScheduledBid(row.id, 'failed', {
        closeTime: refreshedCloseTime,
        lastError: 'Nellis says this item is not currently available for bidding.',
      });
    }

    if (typeof item.nextBid === 'number' && item.nextBid > row.bid_amount) {
      return updateScheduledBid(row.id, 'failed', {
        closeTime: refreshedCloseTime,
        lastError: `Current next bid is $${item.nextBid.toFixed(2)}, above scheduled bid $${row.bid_amount.toFixed(2)}.`,
      });
    }

    const bidResult = await placeBid(cookies, row.product_id, row.bid_amount, null);
    if (!bidResult.success) {
      return updateScheduledBid(row.id, 'failed', {
        closeTime: refreshedCloseTime,
        lastError: bidResult.message || 'Nellis rejected the scheduled bid.',
        lastResult: bidResult.response || bidResult,
      });
    }

    return updateScheduledBid(row.id, 'placed', {
      closeTime: bidResult.response?.data?.projectNewCloseTime?.value || refreshedCloseTime,
      lastResult: bidResult.response || bidResult,
    });
  } catch (err) {
    return updateScheduledBid(row.id, 'failed', {
      lastError: err.message || 'Scheduled bid failed.',
    });
  }
}

export async function runScheduledBidTick() {
  if (schedulerRunning) return;
  schedulerRunning = true;
  try {
    const dueBids = getDuePendingBids();
    for (const row of dueBids) {
      if (!ACTIVE_STATUSES.has(row.status)) continue;
      await executeScheduledBid(row);
    }
  } finally {
    schedulerRunning = false;
  }
}

export function startScheduledBidWorker() {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    runScheduledBidTick().catch((err) => {
      console.error('Scheduled bid worker error:', err.message);
    });
  }, SCHEDULER_INTERVAL_MS);
  schedulerHandle.unref?.();
  runScheduledBidTick().catch((err) => {
    console.error('Scheduled bid startup tick error:', err.message);
  });
}

export { BID_LEAD_TIME_MS };
