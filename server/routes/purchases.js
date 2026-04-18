import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/purchases — paginated list with optional status filter
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const status = req.query.status || 'all';
  const search = req.query.search || '';

  let whereClause = '1=1';
  const params = {};

  if (status !== 'all') {
    whereClause += ' AND status = @status';
    params.status = status;
  }

  if (search) {
    whereClause += ' AND title LIKE @search';
    params.search = `%${search}%`;
  }

  const tripDate = req.query.trip_date || '';
  if (tripDate) {
    whereClause += ' AND DATE(purchase_date) = @trip_date';
    params.trip_date = tripDate;
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM purchases WHERE ${whereClause}`).get(params);
  const total = countRow.total;
  const totalPages = Math.ceil(total / limit);

  const rows = db.prepare(
    `SELECT * FROM purchases WHERE ${whereClause} ORDER BY purchase_date DESC, id DESC LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit, offset });

  res.json({
    purchases: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

// GET /api/purchases/summary — aggregate stats
router.get('/summary', (_req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_items,
      COALESCE(SUM(CASE WHEN total_cost > 0 THEN total_cost ELSE purchase_price END), 0) as total_spent,
      COUNT(CASE WHEN status = 'received' THEN 1 END) as received_count,
      COUNT(CASE WHEN status = 'inspected' THEN 1 END) as inspected_count,
      COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned_count,
      COUNT(CASE WHEN status = 'keep' THEN 1 END) as keep_count,
      COUNT(CASE WHEN status = 'sell_fb' THEN 1 END) as sell_fb_count,
      COUNT(CASE WHEN status = 'sold_fb' THEN 1 END) as sold_fb_count,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      COALESCE(SUM(CASE WHEN status = 'sold_fb' THEN fb_sold_price ELSE 0 END), 0) as total_fb_revenue,
      COALESCE(SUM(CASE WHEN status = 'sold_fb' THEN fb_sold_price - (CASE WHEN total_cost > 0 THEN total_cost ELSE purchase_price END) ELSE 0 END), 0) as total_profit,
      COALESCE(SUM(CASE WHEN status = 'returned' THEN (CASE WHEN total_cost > 0 THEN total_cost ELSE purchase_price END) ELSE 0 END), 0) as returned_cost
    FROM purchases
  `).get();

  res.json(stats);
});

// GET /api/purchases/trips — per-trip analytics grouped by purchase_date
router.get('/trips', (_req, res) => {
  const trips = db.prepare(`
    SELECT
      DATE(purchase_date) as trip_date,
      COUNT(*) as total_items,
      COALESCE(SUM(CASE WHEN total_cost > 0 THEN total_cost ELSE purchase_price END), 0) as total_spent,
      COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned_count,
      COALESCE(SUM(CASE WHEN status = 'returned' THEN (CASE WHEN total_cost > 0 THEN total_cost ELSE purchase_price END) ELSE 0 END), 0) as returned_cost,
      COUNT(CASE WHEN status = 'keep' THEN 1 END) as keep_count,
      COUNT(CASE WHEN status = 'sell_fb' THEN 1 END) as sell_fb_count,
      COUNT(CASE WHEN status = 'sold_fb' THEN 1 END) as sold_fb_count,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN status = 'received' THEN 1 END) as received_count,
      COALESCE(SUM(CASE WHEN status = 'sold_fb' THEN fb_sold_price ELSE 0 END), 0) as fb_revenue,
      COALESCE(SUM(CASE WHEN status = 'sold_fb' THEN fb_sold_price - (CASE WHEN total_cost > 0 THEN total_cost ELSE purchase_price END) ELSE 0 END), 0) as net_profit
    FROM purchases
    WHERE purchase_date IS NOT NULL
    GROUP BY DATE(purchase_date)
    ORDER BY trip_date DESC
  `).all();

  res.json(trips);
});

// PATCH /api/purchases/:id — update status, fb_sold_price, notes
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const allowedFields = ['status', 'fb_sold_price', 'fb_sold_date', 'notes'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  // Auto-set fb_sold_date when marking as sold
  if (updates.status === 'sold_fb' && !updates.fb_sold_date) {
    updates.fb_sold_date = new Date().toISOString();
  }

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`);
  setClauses.push("updated_at = datetime('now')");

  const stmt = db.prepare(
    `UPDATE purchases SET ${setClauses.join(', ')} WHERE id = @id`
  );

  const result = stmt.run({ ...updates, id: parseInt(id) });

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Purchase not found' });
  }

  const updated = db.prepare('SELECT * FROM purchases WHERE id = ?').get(parseInt(id));
  res.json(updated);
});

// PATCH /api/purchases/bulk/status — bulk update status
router.patch('/bulk/status', (req, res) => {
  const { ids, status } = req.body;

  if (!Array.isArray(ids) || ids.length === 0 || !status) {
    return res.status(400).json({ error: 'ids (array) and status are required' });
  }

  const validStatuses = ['pending', 'received', 'inspected', 'returned', 'keep', 'sell_fb', 'sold_fb'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(
    `UPDATE purchases SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
  );
  const result = stmt.run(status, ...ids.map(Number));

  res.json({ updated: result.changes });
});

export default router;
