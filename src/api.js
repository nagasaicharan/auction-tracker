const API_BASE = '/api';

export async function fetchPurchases({ page = 1, limit = 20, status = 'all', search = '', trip_date = '' } = {}) {
  const params = new URLSearchParams({ page, limit, status, search });
  if (trip_date) params.set('trip_date', trip_date);
  const res = await fetch(`${API_BASE}/purchases?${params}`);
  if (!res.ok) throw new Error('Failed to fetch purchases');
  return res.json();
}

export async function fetchTrips() {
  const res = await fetch(`${API_BASE}/purchases/trips`);
  if (!res.ok) throw new Error('Failed to fetch trips');
  return res.json();
}

export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/purchases/summary`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function updatePurchase(id, data) {
  const res = await fetch(`${API_BASE}/purchases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update purchase');
  return res.json();
}

export async function bulkUpdateStatus(ids, status) {
  const res = await fetch(`${API_BASE}/purchases/bulk/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  });
  if (!res.ok) throw new Error('Failed to bulk update');
  return res.json();
}

export async function syncPurchases() {
  const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Sync failed');
  }
  return res.json();
}

export async function submitReturnRequest(buyNowId, returnTypeId, returnReason) {
  const res = await fetch(`${API_BASE}/returns/${buyNowId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnTypeId, returnReason }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Return request failed');
  }
  return res.json();
}

export async function getAuthStatus() {
  const res = await fetch(`${API_BASE}/auth/status`);
  if (!res.ok) throw new Error('Failed to check auth');
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch (_) {
    if (!res.ok) throw new Error(`Login failed (${res.status})`);
  }
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function logout() {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
}
