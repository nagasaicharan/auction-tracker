import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Ban, CheckCircle2, Clock, ExternalLink, RefreshCw, Search, XCircle } from 'lucide-react';
import { cancelScheduledBid, createScheduledBid, fetchBidItem, fetchScheduledBids } from '../api';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'placed', label: 'Placed' },
  { value: 'failed', label: 'Failed' },
  { value: 'missed', label: 'Missed' },
  { value: 'cancelled', label: 'Cancelled' },
];

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

function statusClass(status) {
  if (status === 'placed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed' || status === 'missed') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'cancelled') return 'bg-gray-50 text-gray-600 border-gray-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function StatusIcon({ status }) {
  if (status === 'placed') return <CheckCircle2 size={14} />;
  if (status === 'failed' || status === 'missed') return <XCircle size={14} />;
  if (status === 'cancelled') return <Ban size={14} />;
  return <Clock size={14} />;
}

export default function ScheduledBids() {
  const [productId, setProductId] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [item, setItem] = useState(null);
  const [bids, setBids] = useState([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [fetchingItem, setFetchingItem] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [scheduleMessage, setScheduleMessage] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadBids = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScheduledBids(status);
      setBids(Array.isArray(data.bids) ? data.bids : []);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadBids();
  }, [loadBids]);

  useEffect(() => {
    const handle = setInterval(loadBids, 15_000);
    return () => clearInterval(handle);
  }, [loadBids]);

  const cancelBid = async (id) => {
    setCancellingId(id);
    setError(null);
    try {
      await cancelScheduledBid(id);
      await loadBids();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const lookupItem = async (event) => {
    event.preventDefault();
    if (!productId.trim()) return;

    setFetchingItem(true);
    setLookupError(null);
    setScheduleMessage(null);
    setItem(null);

    try {
      const data = await fetchBidItem(productId.trim());
      setItem(data.item);
      setBidAmount(data.item?.nextBid ? String(data.item.nextBid) : '');
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setFetchingItem(false);
    }
  };

  const scheduleFetchedItem = async (event) => {
    event.preventDefault();
    if (!item) return;

    const amount = Number(bidAmount);
    if (!amount || Number.isNaN(amount)) {
      setLookupError('Enter a numeric bid amount.');
      return;
    }

    if (!item.closeTime) {
      setLookupError('This item does not have a close time to schedule against.');
      return;
    }

    setScheduling(true);
    setLookupError(null);
    setScheduleMessage(null);

    try {
      const data = await createScheduledBid({
        productId: item.id,
        title: item.title,
        imageUrl: item.image,
        closeTime: item.closeTime,
        bidAmount: amount,
      });
      setScheduleMessage(`Scheduled ${formatMoney(data.bid.bidAmount)} for ${formatTime(data.bid.scheduledFor)}.`);
      await loadBids();
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <form onSubmit={lookupItem} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="text-xs text-gray-600">
            Item number
            <input
              type="number"
              min="1"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              placeholder="114175533"
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <button
            type="submit"
            disabled={fetchingItem || !productId.trim()}
            className="h-10 px-4 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Search size={15} />
            {fetchingItem ? 'Fetching...' : 'Fetch Item'}
          </button>
        </form>

        {lookupError && (
          <div className="p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">
            <span className="inline-flex items-center gap-1.5">
              <AlertCircle size={14} />
              {lookupError}
            </span>
          </div>
        )}

        {scheduleMessage && (
          <div className="p-3 border border-emerald-200 bg-emerald-50 rounded-lg text-sm text-emerald-700">
            {scheduleMessage}
          </div>
        )}

        {item ? (
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="w-full md:w-36 md:shrink-0">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-24 object-contain rounded-md border border-gray-200 bg-gray-50"
                  />
                ) : (
                  <div className="w-full h-24 rounded-md border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400">No image</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-5">{item.title}</p>
                <a
                  href={`https://www.nellisauction.com/p/product/${item.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 mt-1"
                >
                  <ExternalLink size={12} />
                  Open on Nellis
                </a>
                <p className="text-xs text-gray-500 mt-1">ID: {item.id} • Inventory: {item.inventoryNumber || '-'}</p>
                <p className="text-xs text-gray-500 mt-1">Status: {item.marketStatus || '-'} • Close: {formatTime(item.closeTime)}</p>
                <div className="grid gap-1 mt-2 text-xs sm:grid-cols-3">
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Current</span>
                    <span className="font-medium sm:block">{formatMoney(item.currentPrice)}</span>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Next bid</span>
                    <span className="font-medium sm:block">{formatMoney(item.nextBid)}</span>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Retail</span>
                    <span className="font-medium sm:block">{formatMoney(item.retailPrice)}</span>
                  </div>
                </div>
              </div>
              <form onSubmit={scheduleFetchedItem} className="w-full md:w-56 shrink-0 space-y-2">
                <label className="text-xs text-gray-600 block">
                  Bid amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bidAmount}
                    onChange={(event) => setBidAmount(event.target.value)}
                    placeholder={item.nextBid ? String(item.nextBid) : 'Enter bid'}
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <button
                  type="submit"
                  disabled={scheduling || item.canBid === false}
                  className="w-full px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                >
                  <Clock size={13} />
                  {scheduling ? 'Scheduling...' : 'Schedule for 4s left'}
                </button>
                {item.canBid === false ? (
                  <p className="text-xs text-red-700">Nellis says bidding is unavailable for this item.</p>
                ) : null}
              </form>
            </div>
          </div>
        ) : null}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="block mt-1 border border-gray-300 rounded-lg px-2 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={loadBids}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw size={14} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
        <span className="text-xs text-gray-500 ml-auto">
          Last updated: {updatedAt || '-'}
        </span>
      </div>

      {error && (
        <div className="p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">
          <span className="inline-flex items-center gap-1.5">
            <AlertCircle size={14} />
            {error}
          </span>
        </div>
      )}

      {!loading && bids.length === 0 && !error ? (
        <div className="text-center py-10 text-gray-500">No scheduled bids found.</div>
      ) : null}

      <div className="space-y-3">
        {bids.map((bid) => (
          <div key={bid.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="w-full md:w-28 md:shrink-0">
                {bid.imageUrl ? (
                  <img
                    src={bid.imageUrl}
                    alt={bid.title}
                    className="w-full h-20 object-contain rounded-md border border-gray-200 bg-gray-50"
                  />
                ) : (
                  <div className="w-full h-20 rounded-md border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400">No image</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm leading-5">{bid.title}</p>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${statusClass(bid.status)}`}>
                    <StatusIcon status={bid.status} />
                    {bid.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">ID: {bid.productId} • Attempts: {bid.attempts}</p>
                <p className="text-xs text-gray-500 mt-1">Close: {formatTime(bid.closeTime)} • Runs: {formatTime(bid.scheduledFor)}</p>
                {bid.lastError ? (
                  <p className="text-xs text-red-700 mt-2">{bid.lastError}</p>
                ) : null}
              </div>
              <div className="w-full md:w-44 shrink-0 space-y-2">
                <div className="text-xs flex justify-between">
                  <span className="text-gray-500">Bid amount</span>
                  <span className="font-semibold">{formatMoney(bid.bidAmount)}</span>
                </div>
                {bid.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={() => cancelBid(bid.id)}
                    disabled={cancellingId === bid.id}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {cancellingId === bid.id ? 'Cancelling...' : 'Cancel'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
