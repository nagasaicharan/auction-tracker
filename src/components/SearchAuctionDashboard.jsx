import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, TrendingUp, RefreshCw, Send, AlertCircle, ExternalLink } from 'lucide-react';
import { searchItems, testBid } from '../api';

const SORT_OPTIONS = [
  { value: 'valueMarginPercent', label: 'Best discount % (highest first)' },
  { value: 'valueMargin', label: 'Highest value spread' },
  { value: 'retailPrice', label: 'Highest retail' },
  { value: 'currentPrice', label: 'Lowest current bid' },
  { value: 'closeTime', label: 'Ending soon' },
];

const SECONDARY_SORT_OPTIONS = [
  { value: '', label: 'None' },
  ...SORT_OPTIONS,
];

function compareValues(a, b, sortType, direction = 1) {
  const valueA = a?.[sortType];
  const valueB = b?.[sortType];

  if (sortType === 'closeTime') {
    const timeA = new Date(a.closeTime || 0).getTime();
    const timeB = new Date(b.closeTime || 0).getTime();
    if (timeA === timeB) return 0;
    return timeA < timeB ? -1 * direction : 1 * direction;
  }

  if (sortType === 'currentPrice') {
    const left = valueA ?? Infinity;
    const right = valueB ?? Infinity;
    if (left === right) return 0;
    return left < right ? -1 * direction : 1 * direction;
  }

  const left = valueA ?? -Infinity;
  const right = valueB ?? -Infinity;
  if (left === right) return 0;
  return left < right ? 1 * direction : -1 * direction;
}

function compareSort(a, b, primarySortBy, secondarySortBy) {
  const first = compareValues(a, b, primarySortBy, 1);
  if (first !== 0) return first;
  if (!secondarySortBy) return 0;
  const second = compareValues(a, b, secondarySortBy, 1);
  if (second !== 0) return second;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

function hasNoDamage(item) {
  if (!item?.damageType || typeof item.damageType !== 'string') return false;
  const normalized = item.damageType.trim().toLowerCase();
  return ['none', 'n/a', 'na', 'no', 'no damage'].includes(normalized);
}

function hasMinorDamage(item) {
  if (!item?.damageType || typeof item.damageType !== 'string') return false;
  const normalized = item.damageType.trim().toLowerCase();
  return ['minor', 'small', 'light', 'slight', 'low'].includes(normalized);
}

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

function computeTimeLeft(closeTime) {
  if (!closeTime) return null;
  const diff = new Date(closeTime).getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return 'Closed';
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

function isPositiveTagValue(value) {
  if (typeof value === 'string') {
    return ['yes', 'new', 'true'].includes(value.toLowerCase());
  }

  return Boolean(value);
}

function tagClassByKind(kind, value) {
  if (kind === 'damage') {
    return isPositiveTagValue(value) ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300';
  }

  if (kind === 'functional') {
    return isPositiveTagValue(value) ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300';
  }

  if (kind === 'grade') {
    return value?.toLowerCase?.() === 'new'
      ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
      : 'bg-gray-100 text-gray-800 border-gray-300';
  }

  return 'bg-gray-100 text-gray-800 border-gray-300';
}

export default function SearchAuctionDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationName, setLocationName] = useState('Delran');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [sortBy, setSortBy] = useState('valueMarginPercent');
  const [secondarySortBy, setSecondarySortBy] = useState('');
  const [onlyNoDamage, setOnlyNoDamage] = useState(false);
  const [onlyMinorDamage, setOnlyMinorDamage] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pollSeconds, setPollSeconds] = useState(30);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ total: 0, returnedAt: null });
  const [biddingId, setBiddingId] = useState(null);

  const [bidDraftById, setBidDraftById] = useState({});
  const [bidStatusById, setBidStatusById] = useState({});
  const [selectedPhotoById, setSelectedPhotoById] = useState({});

  const activeFilters = useMemo(() => {
    const filters = {};
    if (searchQuery.trim()) filters.search = searchQuery.trim();
    if (locationName.trim()) filters['Location Name'] = locationName.trim();
    if (onlyOpen) filters.MarketStatus = 'open';
    return filters;
  }, [searchQuery, locationName, onlyOpen]);

  const sortedItems = useMemo(() => {
    const cloned = [...items];
    const filtered = cloned.filter((item) => {
      if (onlyNoDamage) return hasNoDamage(item);
      if (onlyMinorDamage) return hasMinorDamage(item);
      return true;
    });
    return filtered.sort((a, b) => compareSort(a, b, sortBy, secondarySortBy));
  }, [items, sortBy, secondarySortBy, onlyNoDamage, onlyMinorDamage]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await searchItems(activeFilters);
      const nextItems = Array.isArray(response.items) ? response.items : [];
      setItems(nextItems);
      setMeta({
        total: response.searchResultsCount || nextItems.length,
        returnedAt: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeFilters]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!autoRefresh || pollSeconds < 5) return undefined;
    const handle = setInterval(() => {
      loadItems();
    }, pollSeconds * 1000);
    return () => clearInterval(handle);
  }, [autoRefresh, pollSeconds, loadItems]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    loadItems();
  };

  const setBidDraft = (productId, value) => {
    setBidDraftById((prev) => ({ ...prev, [productId]: value }));
  };

  const submitBid = async (item) => {
    const productId = item.id;
    const raw = Number(bidDraftById[productId]);
    if (!raw || Number.isNaN(raw)) {
      setBidStatusById((prev) => ({ ...prev, [productId]: { type: 'error', message: 'Enter a numeric bid amount.' } }));
      return;
    }

    setBiddingId(productId);
    setBidStatusById((prev) => ({ ...prev, [productId]: { type: 'loading', message: 'Submitting bid...' } }));

    try {
      const result = await testBid({
        productId,
        bid: raw,
        recaptchaToken: null,
      });
      const nextPrice = result?.response?.data?.currentAmount;
      const nextMinimum = result?.response?.data?.minimumNextBid;
      const closeTime = result?.response?.data?.projectNewCloseTime?.value || null;
      setBidStatusById((prev) => ({ ...prev, [productId]: { type: 'success', message: result.message || 'Bid sent.' } }));
      setItems((prevItems) => prevItems.map((row) => (
        row.id === productId
          ? {
              ...row,
              currentPrice: typeof nextPrice === 'number' ? nextPrice : row.currentPrice,
              nextBid: typeof nextMinimum === 'number' ? nextMinimum : row.nextBid,
              closeTime: closeTime || row.closeTime,
            }
          : row
      )));
    } catch (err) {
      setBidStatusById((prev) => ({
        ...prev,
        [productId]: {
          type: 'error',
          message: err.message || 'Bid failed',
          payload: err.payload || null,
        },
      }));
    } finally {
      setBiddingId(null);
      setBidDraftById((prev) => ({ ...prev, [productId]: '' }));
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearchSubmit} className="bg-white border border-gray-200 rounded-xl p-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
        <label className="text-xs text-gray-600">
          Search
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Title, keyword, inventory #..."
            className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="text-xs text-gray-600">
          Location
          <input
            value={locationName}
            onChange={(event) => setLocationName(event.target.value)}
            placeholder="Delran"
            className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button
          type="submit"
          className="self-end h-10 px-4 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Search size={15} />
          {loading ? 'Searching…' : 'Search'}
        </button>
        <div className="flex items-end gap-2">
          <label className="text-xs text-gray-600">
            Poll every (sec)
            <input
              type="number"
              min="5"
              step="5"
              value={pollSeconds}
              onChange={(event) => setPollSeconds(Math.max(5, Number(event.target.value) || 5))}
              className="w-20 mt-1 border border-gray-300 rounded-lg px-2 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={onlyOpen}
                onChange={(event) => setOnlyOpen(event.target.checked)}
                className="rounded border-gray-300"
              />
              Open only
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              Auto-refresh: {autoRefresh ? 'on' : 'off'}
            </span>
            <button
              type="button"
              onClick={() => setAutoRefresh((value) => !value)}
              className="mt-1 w-full text-xs px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
            >
              {autoRefresh ? 'Pause' : 'Start'} auto-refresh
            </button>
          </label>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-gray-600">
          Sort
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="ml-1.5 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Then by
          <select
            value={secondarySortBy}
            onChange={(event) => setSecondarySortBy(event.target.value)}
            className="ml-1.5 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
          >
            {SECONDARY_SORT_OPTIONS.map((option) => (
              <option key={option.value || 'none'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={onlyNoDamage}
              onChange={(event) => {
                const checked = event.target.checked;
                setOnlyNoDamage(checked);
                if (checked) setOnlyMinorDamage(false);
              }}
              className="rounded border-gray-300"
            />
            No damage only
          </span>
        </label>
        <label className="text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={onlyMinorDamage}
              onChange={(event) => {
                const checked = event.target.checked;
                setOnlyMinorDamage(checked);
                if (checked) setOnlyNoDamage(false);
              }}
              className="rounded border-gray-300"
            />
            Minor damage only
          </span>
        </label>
        <button
          type="button"
          onClick={loadItems}
          className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100"
        >
          <RefreshCw size={14} />
          Refresh now
        </button>
        <span className="text-xs text-gray-500 ml-auto">
          {loading ? 'Updating…' : `Last updated: ${meta.returnedAt || '-'}`}
        </span>
        {meta.total ? (
          <span className="text-xs text-gray-600">
            Showing {sortedItems.length} of {meta.total}
          </span>
        ) : null}
      </div>

      {error && (
        <div className="p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="text-center py-10 text-gray-500">Loading live results…</div>
      )}

      {!loading && sortedItems.length === 0 && !error && (
        <div className="text-center py-10 text-gray-500">No matching items found.</div>
      )}

      <div className="space-y-3">
        {sortedItems.map((item) => {
          const itemLinkId = item.id || item.productId || item.product_id;
          const hasNoDamage = item.damageType ? String(item.damageType).toLowerCase() === 'none' : false;
          return (
          <div key={item.id || itemLinkId} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="w-full md:w-48 md:shrink-0 space-y-2">
                {item.image ? (
                  <img
                    src={selectedPhotoById[item.id] || item.image}
                    alt={item.title}
                    className="w-full h-28 object-contain rounded-md border border-gray-200 bg-gray-50"
                  />
                ) : (
                  <div className="w-full h-28 rounded-md border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400">No image</div>
                )}
                {item.photos?.length > 1 ? (
                  <div className="grid grid-cols-4 gap-1">
                    {item.photos.slice(0, 8).map((photoUrl) => (
                      <button
                        type="button"
                        key={photoUrl}
                        onClick={() => setSelectedPhotoById((prev) => ({ ...prev, [item.id]: photoUrl }))}
                        className={`border rounded ${selectedPhotoById[item.id] === photoUrl ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200'}`}
                      >
                        <img src={photoUrl} alt={`${item.title} thumbnail`} className="w-full h-12 object-cover rounded" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-5 line-clamp-2">{item.title}</p>
                {itemLinkId ? (
                  <a
                  href={`https://www.nellisauction.com/p/product/${itemLinkId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 mt-1"
                  >
                    <ExternalLink size={12} />
                    Deal rating on Nellis
                  </a>
                ) : null}
                <p className="text-xs text-gray-500 mt-1">ID: {item.id} • Inventory: {item.inventoryNumber || '-'}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {item.gradeCategory ? (
                    <span
                      className={`inline-flex text-xs px-2 py-1 rounded-full border ${tagClassByKind('grade', item.gradeCategory)}`}
                    >
                      Grade: {item.gradeCategory}
                    </span>
                  ) : null}
                  {item.damageType ? (
                    <span
                      className={`inline-flex text-xs px-2 py-1 rounded-full border ${tagClassByKind('damage', hasNoDamage)}`}
                    >
                      Damage: {item.damageType}
                    </span>
                    ) : null}
                  {item.functionalType ? (
                    <span
                      className={`inline-flex text-xs px-2 py-1 rounded-full border ${tagClassByKind('functional', item.functionalType)}`}
                    >
                      Functional: {item.functionalType}
                    </span>
                  ) : null}
                  {!item.gradeCategory && !item.damageType && !item.functionalType ? (
                    <span className="inline-flex text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-400 bg-gray-50">No grading details</span>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500 mt-1">Location: {item.locationName || '-'} • Status: {item.marketStatus || '-'} • Close: {formatTime(item.closeTime)}</p>
                <p className="text-xs text-gray-500 mt-1">Time left: {computeTimeLeft(item.closeTime)} • Bidder count: {item.bidderCount} • Bid count: {item.bidCount}</p>
                {item.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-2">Notes: {item.notes}</p>}
              </div>
              <div className="w-full md:w-64 shrink-0 space-y-2">
                <div className="text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Retail</span>
                    <span className="font-medium">{formatMoney(item.retailPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current</span>
                    <span className="font-medium">{formatMoney(item.currentPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Value spread</span>
                    <span className="font-semibold text-emerald-700">
                      {item.valueMargin === null ? '-' : formatMoney(item.valueMargin)}
                      {item.valueMarginPercent === null ? '' : ` (${item.valueMarginPercent}%)`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Next bid</span>
                    <span>{formatMoney(item.nextBid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rating</span>
                    <span className="inline-flex items-center gap-1">
                      <TrendingUp size={12} />
                      {item.rating === null ? '-' : item.rating.toFixed(2)}
                    </span>
                  </div>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitBid(item);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={bidDraftById[item.id] || ''}
                    onChange={(event) => setBidDraft(item.id, event.target.value)}
                    placeholder={item.nextBid ? String(item.nextBid) : 'Enter bid'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={biddingId === item.id || item.canBid === false}
                    className="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <Send size={13} />
                    {biddingId === item.id ? 'Bidding…' : item.canBid === false ? 'Unavailable' : 'Bid'}
                  </button>
                </form>

                <div className="text-xs min-h-5">
                  {bidStatusById[item.id]?.type === 'loading' && (
                    <p className="text-gray-500">Submitting bid…</p>
                  )}
                  {bidStatusById[item.id]?.type === 'success' && (
                    <p className="text-emerald-700">{bidStatusById[item.id].message}</p>
                  )}
                  {bidStatusById[item.id]?.type === 'error' && (
                    <p className="text-red-700">
                      <span className="inline-flex items-center gap-1"><AlertCircle size={12} />{bidStatusById[item.id].message}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
