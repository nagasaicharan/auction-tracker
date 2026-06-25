import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Clock,
  ExternalLink,
  Play,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import {
  createScheduledBid,
  deleteSavedSearch,
  fetchLostAuctionLiveMatches,
  fetchLostRelistScanStatus,
  fetchSavedSearches,
  markSavedSearchRun,
  startLostRelistScan,
  updateSavedSearch,
} from '../api';

function formatMoney(value) {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function describeFilters(search) {
  const filters = search.filters || {};
  if (search.source === 'nellis') {
    return [
      'Nellis website',
      filters.search || search.name,
      [search.city, search.state].filter(Boolean).join(', '),
    ].filter(Boolean).join(' · ');
  }

  return [
    filters['Location Name'] || 'Any location',
    filters.search || 'All items',
    filters.MarketStatus === 'open' ? 'Open only' : 'All statuses',
  ].join(' · ');
}

export default function SavedSearches({ onRunSearch }) {
  const [searches, setSearches] = useState([]);
  const [editingNames, setEditingNames] = useState({});
  const [loadingSearches, setLoadingSearches] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [websiteWarning, setWebsiteWarning] = useState(null);

  const [lostRows, setLostRows] = useState([]);
  const [lostDisplayLimit, setLostDisplayLimit] = useState(100);
  const [lostLocation, setLostLocation] = useState('Delran');
  const [loadingLost, setLoadingLost] = useState(false);
  const [lostError, setLostError] = useState(null);
  const [lostUpdatedAt, setLostUpdatedAt] = useState(null);
  const [onlyMatches, setOnlyMatches] = useState(false);
  const [scanStatus, setScanStatus] = useState(null);
  const [startingScan, setStartingScan] = useState(false);

  const [bidDraftById, setBidDraftById] = useState({});
  const [scheduleStatusById, setScheduleStatusById] = useState({});
  const [schedulingId, setSchedulingId] = useState(null);

  const loadSearches = useCallback(async () => {
    setLoadingSearches(true);
    setSearchError(null);
    try {
      const data = await fetchSavedSearches();
      const nextSearches = Array.isArray(data.searches) ? data.searches : [];
      setSearches(nextSearches);
      setEditingNames(Object.fromEntries(nextSearches.map((item) => [item.id, item.name])));
      setWebsiteWarning(data.websiteError || null);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setLoadingSearches(false);
    }
  }, []);

  const loadLostMatches = useCallback(async () => {
    setLoadingLost(true);
    setLostError(null);
    try {
      const data = await fetchLostAuctionLiveMatches({
        limit: lostDisplayLimit,
        locationName: lostLocation.trim(),
        onlyMatches,
      });
      setLostRows(Array.isArray(data.rows) ? data.rows : []);
      setScanStatus(data.scan || null);
      setLostUpdatedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setLostError(err.message);
    } finally {
      setLoadingLost(false);
    }
  }, [lostDisplayLimit, lostLocation, onlyMatches]);

  const loadScanStatus = useCallback(async () => {
    try {
      const data = await fetchLostRelistScanStatus();
      setScanStatus(data.scan || null);
      return data.scan || null;
    } catch (err) {
      setLostError(err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    loadSearches();
  }, [loadSearches]);

  useEffect(() => {
    loadLostMatches();
  }, [loadLostMatches]);

  useEffect(() => {
    if (!scanStatus?.running) return undefined;
    const handle = setInterval(async () => {
      const nextScan = await loadScanStatus();
      if (!nextScan?.running) {
        await loadLostMatches();
      }
    }, 5000);
    return () => clearInterval(handle);
  }, [loadLostMatches, loadScanStatus, scanStatus?.running]);

  const startScan = async () => {
    setStartingScan(true);
    setLostError(null);
    try {
      const data = await startLostRelistScan({ locationName: lostLocation.trim() });
      setScanStatus(data.scan || null);
    } catch (err) {
      setLostError(err.message);
    } finally {
      setStartingScan(false);
    }
  };

  const runSearch = async (search) => {
    onRunSearch(search);
    if (search.readOnly || search.source === 'nellis') return;
    try {
      await markSavedSearchRun(search.id, search.lastResultCount || 0);
    } catch {
      // Running the preset should not be blocked by metadata updates.
    }
  };

  const saveName = async (search) => {
    setSearchError(null);
    try {
      await updateSavedSearch(search.id, {
        ...search,
        name: editingNames[search.id] || search.name,
      });
      await loadSearches();
    } catch (err) {
      setSearchError(err.message);
    }
  };

  const removeSearch = async (id) => {
    setSearchError(null);
    try {
      await deleteSavedSearch(id);
      await loadSearches();
    } catch (err) {
      setSearchError(err.message);
    }
  };

  const setBidDraft = (productId, value) => {
    setBidDraftById((prev) => ({ ...prev, [productId]: value }));
  };

  const scheduleMatch = async (match) => {
    const productId = match.id;
    const raw = Number(bidDraftById[productId]);
    if (!raw || Number.isNaN(raw)) {
      setScheduleStatusById((prev) => ({
        ...prev,
        [productId]: { type: 'error', message: 'Enter a numeric bid amount.' },
      }));
      return;
    }

    if (!match.closeTime) {
      setScheduleStatusById((prev) => ({
        ...prev,
        [productId]: { type: 'error', message: 'This match has no close time.' },
      }));
      return;
    }

    setSchedulingId(productId);
    setScheduleStatusById((prev) => ({
      ...prev,
      [productId]: { type: 'loading', message: 'Scheduling bid...' },
    }));

    try {
      const result = await createScheduledBid({
        productId,
        title: match.title,
        imageUrl: match.image,
        closeTime: match.closeTime,
        bidAmount: raw,
      });
      setScheduleStatusById((prev) => ({
        ...prev,
        [productId]: {
          type: 'success',
          message: `Scheduled ${formatMoney(result.bid.bidAmount)} for ${formatTime(result.bid.scheduledFor)}.`,
        },
      }));
      setBidDraftById((prev) => ({ ...prev, [productId]: '' }));
    } catch (err) {
      setScheduleStatusById((prev) => ({
        ...prev,
        [productId]: { type: 'error', message: err.message || 'Schedule failed.' },
      }));
    } finally {
      setSchedulingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Saved Searches</h2>
          <button
            type="button"
            onClick={loadSearches}
            disabled={loadingSearches}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
          >
            <RefreshCw size={14} />
            {loadingSearches ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {searchError ? (
          <div className="p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">
            <span className="inline-flex items-center gap-1.5"><AlertCircle size={14} />{searchError}</span>
          </div>
        ) : null}

        {websiteWarning ? (
          <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg text-sm text-amber-800">
            <span className="inline-flex items-center gap-1.5"><AlertCircle size={14} />Nellis saved searches did not load: {websiteWarning}</span>
          </div>
        ) : null}

        {!loadingSearches && searches.length === 0 && !searchError ? (
          <div className="text-center py-8 text-gray-500 bg-white border border-gray-200 rounded-xl">
            No saved searches yet.
          </div>
        ) : null}

        <div className="space-y-3">
          {searches.map((search) => (
            <div key={search.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                <div className="min-w-0">
                  <label className="text-xs text-gray-600">
                    Name
                    <input
                      value={editingNames[search.id] || ''}
                      onChange={(event) => setEditingNames((prev) => ({ ...prev, [search.id]: event.target.value }))}
                      readOnly={search.readOnly}
                      className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex text-xs px-2 py-1 rounded-full border ${
                      search.source === 'nellis'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {search.source === 'nellis' ? 'Nellis' : 'Local'}
                    </span>
                    <p className="text-xs text-gray-500">{describeFilters(search)}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Sort: {search.sortBy}
                    {search.secondarySortBy ? ` then ${search.secondarySortBy}` : ''}
                    {' '}· Poll: {search.autoRefresh ? `${search.pollSeconds}s` : 'off'}
                  </p>
                  {search.lastRunAt ? (
                    <p className="text-xs text-gray-400 mt-1">Last run: {formatTime(search.lastRunAt)}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => runSearch(search)}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Play size={13} />
                    Run
                  </button>
                  <button
                    type="button"
                    onClick={() => saveName(search)}
                    disabled={search.readOnly}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100"
                  >
                    <Save size={13} />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSearch(search.id)}
                    disabled={search.readOnly}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 grid gap-3 md:grid-cols-[auto_auto_auto_auto_1fr] md:items-end">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Lost Relists</h2>
            <p className="text-xs text-gray-500 mt-1">Background scan is throttled and cached locally.</p>
          </div>
          <label className="text-xs text-gray-600">
            Show rows
            <input
              type="number"
              min="1"
              max="500"
              value={lostDisplayLimit}
              onChange={(event) => setLostDisplayLimit(Math.min(500, Math.max(1, Number(event.target.value) || 1)))}
              className="block mt-1 w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            Location
            <input
              value={lostLocation}
              onChange={(event) => setLostLocation(event.target.value)}
              placeholder="Optional"
              className="block mt-1 w-44 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            <span className="inline-flex items-center gap-1.5 h-10">
              <input
                type="checkbox"
                checked={onlyMatches}
                onChange={(event) => setOnlyMatches(event.target.checked)}
                className="rounded border-gray-300"
              />
              Matches only
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button
              type="button"
              onClick={startScan}
              disabled={startingScan || scanStatus?.running}
              className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Search size={14} />
              {scanStatus?.running ? 'Scanning...' : startingScan ? 'Starting...' : 'Start scan'}
            </button>
            <button
              type="button"
              onClick={loadLostMatches}
              disabled={loadingLost}
              className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
            >
              <RefreshCw size={14} />
              {loadingLost ? 'Refreshing...' : 'Refresh cache'}
            </button>
            <span className="text-xs text-gray-500">Updated: {lostUpdatedAt || '-'}</span>
          </div>
        </div>

        {scanStatus ? (
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <span className={`inline-flex px-2 py-1 rounded-full border ${
              scanStatus.status === 'running'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : scanStatus.status === 'failed'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200'
            }`}>
              {scanStatus.status}
            </span>
            <span>Processed {scanStatus.processedCount || 0} of {scanStatus.totalLost || '?'}</span>
            <span>Matched {scanStatus.matchedCount || 0}</span>
            <span>Delay {scanStatus.searchDelayMs || 3000}ms/search</span>
            {scanStatus.startedAt ? <span>Started {formatTime(scanStatus.startedAt)}</span> : null}
            {scanStatus.finishedAt ? <span>Finished {formatTime(scanStatus.finishedAt)}</span> : null}
            {scanStatus.error ? <span className="text-red-700">{scanStatus.error}</span> : null}
          </div>
        ) : null}

        {lostError ? (
          <div className="p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">
            <span className="inline-flex items-center gap-1.5"><AlertCircle size={14} />{lostError}</span>
          </div>
        ) : null}

        {!loadingLost && lostRows.length === 0 && !lostError ? (
          <div className="text-center py-8 text-gray-500 bg-white border border-gray-200 rounded-xl">
            Start a scan to build the local lost-relist cache.
          </div>
        ) : null}

        <div className="space-y-3">
          {lostRows.map((row, index) => (
            <div key={`${row.lostItem?.id || row.search || index}`} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="w-full lg:w-72 shrink-0">
                  <div className="flex gap-3">
                    {row.lostItem?.image ? (
                      <img
                        src={row.lostItem.image}
                        alt={row.lostItem.title}
                        className="w-20 h-20 object-contain rounded-md border border-gray-200 bg-gray-50"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-md border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                        No image
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 line-clamp-2">{row.lostItem?.title || 'Lost item'}</p>
                      <p className="text-xs text-gray-500 mt-1">Last sold: {formatMoney(row.lostItem?.lastSoldPrice)}</p>
                      <p className="text-xs text-gray-500 mt-1">Search: {row.search || '-'}</p>
                      {row.lastCheckedAt ? <p className="text-xs text-gray-400 mt-1">Checked: {formatTime(row.lastCheckedAt)}</p> : null}
                    </div>
                  </div>
                  {row.error ? <p className="text-xs text-red-700 mt-2">{row.error}</p> : null}
                </div>

                <div className="flex-1 space-y-2">
                  {row.matches?.length ? row.matches.map((match) => {
                    const status = scheduleStatusById[match.id];
                    return (
                      <div key={match.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start">
                          {match.image ? (
                            <img
                              src={match.image}
                              alt={match.title}
                              className="w-full md:w-24 h-20 object-contain rounded-md border border-gray-200 bg-gray-50"
                            />
                          ) : null}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 line-clamp-2">{match.title}</p>
                            <a
                              href={`https://www.nellisauction.com/p/product/${match.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 mt-1"
                            >
                              <ExternalLink size={12} />
                              Open on Nellis
                            </a>
                            <p className="text-xs text-gray-500 mt-1">
                              Current: {formatMoney(match.currentPrice)}
                              {' '}· Next: {formatMoney(match.nextBid)}
                              {' '}· Close: {formatTime(match.closeTime)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Location: {match.locationName || '-'}</p>
                          </div>
                          <div className="w-full md:w-48 shrink-0 space-y-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={bidDraftById[match.id] || ''}
                              onChange={(event) => setBidDraft(match.id, event.target.value)}
                              placeholder={match.nextBid ? String(match.nextBid) : 'Bid amount'}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => scheduleMatch(match)}
                              disabled={schedulingId === match.id || match.canBid === false}
                              className="w-full px-3 py-2 text-xs bg-white text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                            >
                              <Clock size={13} />
                              {schedulingId === match.id ? 'Scheduling...' : 'Schedule for 29s left'}
                            </button>
                            {status ? (
                              <p className={`text-xs ${status.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
                                {status.message}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-4">
                      No open matches found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
