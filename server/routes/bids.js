import { Router } from 'express';
import { getCookies } from '../cookies.js';
import { placeBid } from '../nellis.js';

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

export default router;
