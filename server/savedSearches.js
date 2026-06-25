import db from './db.js';

const DEFAULT_SEARCH = {
  filters: {},
  sortBy: 'valueMarginPercent',
  secondarySortBy: '',
  onlyNoDamage: false,
  onlyMinorDamage: false,
  autoRefresh: true,
  pollSeconds: 30,
};

function parseFilters(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    filters: parseFilters(row.filters),
    sortBy: row.sort_by,
    secondarySortBy: row.secondary_sort_by,
    onlyNoDamage: Boolean(row.only_no_damage),
    onlyMinorDamage: Boolean(row.only_minor_damage),
    autoRefresh: Boolean(row.auto_refresh),
    pollSeconds: row.poll_seconds,
    lastRunAt: row.last_run_at,
    lastResultCount: row.last_result_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeInput(input, existing = DEFAULT_SEARCH) {
  const name = typeof input.name === 'string' ? input.name.trim() : existing.name;
  if (!name) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }

  const filters = input.filters && typeof input.filters === 'object' && !Array.isArray(input.filters)
    ? input.filters
    : existing.filters || {};
  const pollSeconds = Math.max(5, Number(input.pollSeconds ?? existing.pollSeconds ?? 30) || 30);

  return {
    name,
    filters,
    sortBy: input.sortBy || existing.sortBy || DEFAULT_SEARCH.sortBy,
    secondarySortBy: input.secondarySortBy ?? existing.secondarySortBy ?? '',
    onlyNoDamage: Boolean(input.onlyNoDamage ?? existing.onlyNoDamage),
    onlyMinorDamage: Boolean(input.onlyMinorDamage ?? existing.onlyMinorDamage),
    autoRefresh: Boolean(input.autoRefresh ?? existing.autoRefresh),
    pollSeconds,
  };
}

export function listSavedSearches() {
  return db.prepare(`
    SELECT * FROM saved_searches
    ORDER BY updated_at DESC, id DESC
  `).all().map(normalizeRow);
}

export function createSavedSearch(input) {
  const value = normalizeInput(input);
  const row = db.prepare(`
    INSERT INTO saved_searches (
      name, filters, sort_by, secondary_sort_by, only_no_damage,
      only_minor_damage, auto_refresh, poll_seconds
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).get(
    value.name,
    JSON.stringify(value.filters),
    value.sortBy,
    value.secondarySortBy,
    value.onlyNoDamage ? 1 : 0,
    value.onlyMinorDamage ? 1 : 0,
    value.autoRefresh ? 1 : 0,
    value.pollSeconds,
  );
  return normalizeRow(row);
}

export function updateSavedSearch(id, input) {
  const existing = db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(Number(id));
  if (!existing) return null;
  const value = normalizeInput(input, normalizeRow(existing));
  const row = db.prepare(`
    UPDATE saved_searches
    SET name = ?,
        filters = ?,
        sort_by = ?,
        secondary_sort_by = ?,
        only_no_damage = ?,
        only_minor_damage = ?,
        auto_refresh = ?,
        poll_seconds = ?,
        updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `).get(
    value.name,
    JSON.stringify(value.filters),
    value.sortBy,
    value.secondarySortBy,
    value.onlyNoDamage ? 1 : 0,
    value.onlyMinorDamage ? 1 : 0,
    value.autoRefresh ? 1 : 0,
    value.pollSeconds,
    Number(id),
  );
  return normalizeRow(row);
}

export function markSavedSearchRun(id, resultCount) {
  const row = db.prepare(`
    UPDATE saved_searches
    SET last_run_at = datetime('now'),
        last_result_count = ?,
        updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `).get(Number(resultCount) || 0, Number(id));
  return normalizeRow(row);
}

export function deleteSavedSearch(id) {
  const result = db.prepare('DELETE FROM saved_searches WHERE id = ?').run(Number(id));
  return result.changes > 0;
}
