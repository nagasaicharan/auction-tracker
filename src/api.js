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

export async function fetchAppointments({ page = 0, size = 20 } = {}) {
  const params = new URLSearchParams({ page, size });
  const res = await fetch(`${API_BASE}/appointments?${params}`);
  if (!res.ok) throw new Error('Failed to fetch appointments');
  return res.json();
}

export async function fetchAppointmentSlots(appointmentId) {
  const res = await fetch(`${API_BASE}/appointments/${appointmentId}/slots`);
  if (!res.ok) throw new Error('Failed to fetch appointment slots');
  return res.json();
}

export async function rescheduleAppointment(appointmentId, appointmentTime) {
  const res = await fetch(`${API_BASE}/appointments/${appointmentId}/reschedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointmentTime }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to reschedule appointment');
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

export async function testBid({ productId, bid, recaptchaToken }) {
  const res = await fetch(`${API_BASE}/bids/playground`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId,
      bid,
      recaptchaToken,
    }),
  });
  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { raw: text } : null;
  }

  if (!res.ok) {
    const message = data?.message || data?.error || `Bid test failed (${res.status})`;
    const err = new Error(message);
    err.payload = data;
    throw err;
  }

  return data;
}

export async function searchItems(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined || item === null || item === '') return;
        params.append(key, String(item));
      });
    } else {
      params.set(key, String(value));
    }
  });

  const res = await fetch(`${API_BASE}/search?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Search request failed');
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
