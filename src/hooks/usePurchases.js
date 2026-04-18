import { useState, useEffect, useCallback } from 'react';
import { fetchPurchases, fetchSummary, fetchTrips, updatePurchase as apiUpdatePurchase, bulkUpdateStatus, syncPurchases as apiSync } from '../api';

export function usePurchases() {
  const [purchases, setPurchases] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [summary, setSummary] = useState(null);
  const [trips, setTrips] = useState([]);
  const [filters, setFilters] = useState({ status: 'all', search: '', trip_date: '' });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const loadPurchases = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchases({ page, limit: pagination.limit, ...filters });
      setPurchases(data.purchases);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }, []);

  const loadTrips = useCallback(async () => {
    try {
      const data = await fetchTrips();
      setTrips(data);
    } catch (err) {
      console.error('Failed to load trips:', err);
    }
  }, []);

  useEffect(() => {
    loadPurchases(1);
    loadSummary();
    loadTrips();
  }, [loadPurchases, loadSummary, loadTrips]);

  const goToPage = (page) => {
    loadPurchases(page);
  };

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setSelected(new Set());
  };

  const updatePurchase = async (id, data) => {
    try {
      const updated = await apiUpdatePurchase(id, data);
      setPurchases(prev => prev.map(p => p.id === id ? updated : p));
      loadSummary();
      loadTrips();
    } catch (err) {
      setError(err.message);
    }
  };

  const bulkUpdate = async (status) => {
    if (selected.size === 0) return;
    try {
      await bulkUpdateStatus([...selected], status);
      setSelected(new Set());
      loadPurchases(pagination.page);
      loadSummary();
      loadTrips();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSelected = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === purchases.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(purchases.map(p => p.id)));
    }
  };

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await apiSync();
      loadPurchases(1);
      loadSummary();
      loadTrips();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  const setTripFilter = (trip_date) => {
    updateFilters({ trip_date });
  };

  return {
    purchases, pagination, summary, trips, filters, loading, syncing, error, selected,
    goToPage, updateFilters, updatePurchase, bulkUpdate, toggleSelected, selectAll, sync, setTripFilter,
  };
}
