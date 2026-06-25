import { Router } from 'express';
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  markSavedSearchRun,
  updateSavedSearch,
} from '../savedSearches.js';
import { getCookies } from '../cookies.js';
import { fetchNellisSavedSearches } from '../nellis.js';

const router = Router();

router.get('/', async (_req, res) => {
  const localSearches = listSavedSearches().map((search) => ({ ...search, source: 'local', readOnly: false }));
  const cookies = getCookies();

  if (!cookies || cookies.includes('YOUR_SESSION_COOKIE_HERE')) {
    return res.json({
      searches: localSearches,
      localSearches,
      nellisSearches: [],
      websiteError: 'Not logged in to Nellis.',
    });
  }

  try {
    const website = await fetchNellisSavedSearches(cookies);
    return res.json({
      searches: [...website.records, ...localSearches],
      localSearches,
      nellisSearches: website.records,
      websiteTotal: website.total,
    });
  } catch (err) {
    return res.json({
      searches: localSearches,
      localSearches,
      nellisSearches: [],
      websiteError: err.message,
    });
  }
});

router.post('/', (req, res) => {
  try {
    const search = createSavedSearch(req.body || {});
    res.status(201).json({ search });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const search = updateSavedSearch(req.params.id, req.body || {});
    if (!search) return res.status(404).json({ error: 'Saved search not found' });
    return res.json({ search });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/run', (req, res) => {
  const search = markSavedSearchRun(req.params.id, req.body?.resultCount);
  if (!search) return res.status(404).json({ error: 'Saved search not found' });
  return res.json({ search });
});

router.delete('/:id', (req, res) => {
  if (!deleteSavedSearch(req.params.id)) {
    return res.status(404).json({ error: 'Saved search not found' });
  }
  return res.status(204).end();
});

export default router;
