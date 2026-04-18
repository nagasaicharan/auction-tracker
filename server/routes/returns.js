import { Router } from 'express';
import db from '../db.js';
import { submitReturn } from '../nellis.js';
import { getCookies } from '../cookies.js';

const router = Router();

// POST /api/returns/:buyNowId — submit a return request to Nellis
router.post('/:buyNowId', async (req, res) => {
  const { buyNowId } = req.params;
  const { returnTypeId, returnReason } = req.body;

  if (!returnTypeId || !returnReason) {
    return res.status(400).json({ error: 'returnTypeId and returnReason are required' });
  }

  const cookies = getCookies();
  if (!cookies) {
    return res.status(401).json({ error: 'Not logged in — please log in first' });
  }

  try {
    await submitReturn(cookies, buyNowId, returnTypeId, returnReason);

    // Mark the item as returned in the DB
    db.prepare(
      `UPDATE purchases SET status = 'returned', return_submitted = 1, updated_at = datetime('now') WHERE buy_now_id = ?`
    ).run(parseInt(buyNowId));

    res.json({ success: true });
  } catch (err) {
    console.error('Return error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
