import { Router } from 'express';
import { getCookies } from '../cookies.js';
import { fetchProductDetail, normalizeSearchItem, placeBid } from '../nellis.js';
import {
  cancelScheduledBid,
  createScheduledBid,
  getScheduledBid,
  listScheduledBids,
} from '../scheduledBids.js';

const router = Router();

function ensureLoggedIn(req, res, next) {
  const cookies = getCookies();
  if (!cookies || cookies.includes('YOUR_SESSION_COOKIE_HERE')) {
    return res.status(401).json({ error: 'Not logged in — please log in first' });
  }
  req.cookies = cookies;
  next();
}

router.post('/playground', ensureLoggedIn, async (req, res) => {
  const { productId, bid, recaptchaToken } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }

  if (bid === undefined || bid === null || Number.isNaN(Number(bid))) {
    return res.status(400).json({ error: 'bid must be a valid number' });
  }

  try {
    const result = await placeBid(req.cookies, productId, bid, recaptchaToken);

    if (!result.success) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
        response: result.response,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('Bid playground error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/scheduled', ensureLoggedIn, (req, res) => {
  const bids = listScheduledBids({ status: req.query.status });
  res.json({ bids });
});

router.post('/scheduled', ensureLoggedIn, (req, res) => {
  try {
    const bid = createScheduledBid(req.body);
    res.status(201).json({ bid });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/items/:productId', ensureLoggedIn, async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'productId must be a positive integer' });
  }

  try {
    const detail = await fetchProductDetail(req.cookies, productId, 'product');
    const item = normalizeSearchItem(detail?.product);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    return res.json({ item });
  } catch (err) {
    console.error('Bid item lookup error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/scheduled/:id', ensureLoggedIn, (req, res) => {
  const bid = getScheduledBid(req.params.id);
  if (!bid) {
    return res.status(404).json({ error: 'Scheduled bid not found' });
  }
  return res.json({ bid });
});

router.post('/scheduled/:id/cancel', ensureLoggedIn, (req, res) => {
  const bid = cancelScheduledBid(req.params.id);
  if (!bid) {
    return res.status(404).json({ error: 'Pending scheduled bid not found' });
  }
  return res.json({ bid });
});

export default router;
