import { Router } from 'express';
import { getCookies } from '../cookies.js';
import { fetchSearchResults, normalizeSearchItem } from '../nellis.js';

const router = Router();

function ensureLoggedIn(req, res, next) {
  const cookies = getCookies();
  if (!cookies || cookies.includes('YOUR_SESSION_COOKIE_HERE')) {
    return res.status(401).json({ error: 'Not logged in — please log in first' });
  }
  req.cookies = cookies;
  return next();
}

// GET /api/search
router.get('/', ensureLoggedIn, async (req, res) => {
  const query = { ...req.query };

  try {
    const data = await fetchSearchResults(req.cookies, query);
    const rawProducts = Array.isArray(data.products) ? data.products : [];
    const items = rawProducts
      .map((item) => normalizeSearchItem(item))
      .filter(Boolean)
      .sort((a, b) => {
        const aValue = a.valueMarginPercent ?? -Infinity;
        const bValue = b.valueMarginPercent ?? -Infinity;
        if (aValue !== bValue) return bValue - aValue;
        return a.currentPrice - b.currentPrice;
      });

    res.json({
      items,
      searchResultsCount: data.searchResultsCount ?? items.length,
      selectedFilters: data.selectedFilters || [],
      facets: data.facets || {},
      filterCount: data.filterCount || 0,
      autocompleteFilters: data.autocompleteFilters || null,
      currentShoppingLocation: data.currentShoppingLocation || null,
      algolia: data.algolia || null,
    });
  } catch (err) {
    console.error('Search fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
