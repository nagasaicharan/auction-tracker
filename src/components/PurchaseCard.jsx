import { useState } from 'react';
import StatusDropdown from './StatusDropdown';
import { ExternalLink, MessageSquare, DollarSign, X, ChevronDown, ChevronUp, RotateCcw, AlertCircle, Store, Copy, Check } from 'lucide-react';
import { submitReturnRequest } from '../api.js';

const PLACEHOLDER_IMG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5Y2EzYWYiIGZvbnQtc2l6ZT0iMTIiPk5vIEltZzwvdGV4dD48L3N2Zz4=';

export default function PurchaseCard({ purchase, isSelected, onToggleSelect, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [fbPrice, setFbPrice] = useState(purchase.fb_sold_price || '');
  const [notes, setNotes] = useState(purchase.notes || '');
  const [imgError, setImgError] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnTypeId, setReturnTypeId] = useState(2); // Inaccurate Description default
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState(null);
  const [showFbList, setShowFbList] = useState(false);
  const [copied, setCopied] = useState(false);

  const QUICK_REASONS = [
    'Received random/wrong item',
    'Used item — not as described',
    'Not in good condition',
    'Not working / defective',
    'Damaged product',
  ];

  const RETURN_TYPES = [
    { id: 2, label: 'Inaccurate Description' },
    { id: 4, label: 'Other' },
    { id: 1, label: 'No Longer Wanted' },
    { id: 3, label: 'Never Received' },
  ];

  const handleReturnSubmit = async () => {
    if (!returnReason.trim()) return;
    setReturning(true);
    setReturnError(null);
    try {
      await submitReturnRequest(purchase.buy_now_id, returnTypeId, returnReason);
      onUpdate(purchase.id, { status: 'returned', return_submitted: 1 });
      setShowReturn(false);
      setReturnReason('');
    } catch (err) {
      setReturnError(err.message);
    } finally {
      setReturning(false);
    }
  };

  const showFbPrice = purchase.status === 'sell_fb' || purchase.status === 'sold_fb';

    const buildFbDescription = () => {
      const lines = [purchase.title];
      if (purchase.condition) lines.push(`Condition: ${purchase.condition}`);
      if (purchase.category) lines.push(`Category: ${purchase.category}`);
      if (purchase.location) lines.push(`Pickup: ${purchase.location}`);
      lines.push('\nNo holds. Cash or digital payment only.');
      return lines.join('\n');
    };

    const handleCopyDescription = async () => {
      await navigator.clipboard.writeText(buildFbDescription());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenFbMarketplace = () => {
      window.open('https://www.facebook.com/marketplace/create/item/', '_blank', 'noopener,noreferrer');
    };

  const effectiveCost = purchase.total_cost > 0 ? purchase.total_cost : purchase.purchase_price;
  const profit = purchase.status === 'sold_fb' && purchase.fb_sold_price
    ? (purchase.fb_sold_price - effectiveCost).toFixed(2)
    : null;

  const handleStatusChange = (newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'sold_fb' && fbPrice) {
      updates.fb_sold_price = parseFloat(fbPrice);
    }
    onUpdate(purchase.id, updates);
  };

  const handleFbPriceSave = () => {
    if (!fbPrice) return;
    const updates = { fb_sold_price: parseFloat(fbPrice) };
    if (purchase.status === 'sell_fb') {
      updates.status = 'sold_fb';
    }
    onUpdate(purchase.id, updates);
  };

  const handleNotesSave = () => {
    onUpdate(purchase.id, { notes });
  };

  return (
    <div className={`bg-white rounded-xl border transition-all ${isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'} overflow-hidden`}>
      <div className="flex items-start gap-4 p-4">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(purchase.id)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
        />

        {/* Image */}
        <div className="shrink-0">
          <img
            src={imgError ? PLACEHOLDER_IMG : (purchase.image_url || PLACEHOLDER_IMG)}
            alt={purchase.title}
            onError={() => setImgError(true)}
            className="w-20 h-20 object-cover rounded-lg bg-gray-100"
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-gray-900 text-sm leading-tight line-clamp-2">{purchase.title}</h3>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-lg font-bold text-gray-900">${purchase.total_cost > 0 ? purchase.total_cost.toFixed(2) : purchase.purchase_price?.toFixed(2) || '0.00'}</span>
            {purchase.total_cost > 0 && purchase.purchase_price && (
              <span className="text-xs text-gray-400">
                (${purchase.purchase_price.toFixed(2)} + ${purchase.buyer_premium?.toFixed(2)} prem + ${purchase.tax_amount?.toFixed(2)} tax)
              </span>
            )}
            {purchase.retail_price && (
              <span className="text-xs text-gray-400 line-through">${purchase.retail_price.toFixed(2)} retail</span>
            )}
            {purchase.retail_price && effectiveCost && (
              <span className="text-xs text-emerald-600 font-medium">
                {Math.round((1 - effectiveCost / purchase.retail_price) * 100)}% off
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StatusDropdown status={purchase.status} onChange={handleStatusChange} />
            {purchase.location && (
              <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{purchase.location}</span>
            )}
            {purchase.category && (
              <span className="text-xs text-gray-400">{purchase.category}</span>
            )}
            {purchase.buy_now_id && (
              <div className="ml-auto flex items-center gap-1.5">
                {purchase.return_submitted ? (
                  <span className="text-xs flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                    <RotateCcw size={11} /> Return Submitted
                  </span>
                ) : null}
                <button
                  onClick={() => setShowReturn(!showReturn)}
                  className="text-xs flex items-center gap-1 text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-0.5 rounded transition-colors"
                >
                  <RotateCcw size={11} /> Return
                </button>
              </div>
            )}
          </div>

          {/* FB Price Row */}
          {/* FB List Helper */}
          {purchase.status === 'sell_fb' && (
            <div className="mt-2">
              <button
                onClick={() => setShowFbList(!showFbList)}
                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-2 py-0.5 rounded transition-colors"
              >
                <Store size={11} /> List on FB Marketplace
              </button>

              {showFbList && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-700 flex items-center gap-1"><Store size={12} /> FB Marketplace Helper</span>
                    <button onClick={() => setShowFbList(false)} className="text-blue-400 hover:text-blue-600"><X size={14} /></button>
                  </div>

                  {purchase.image_url && (
                    <div className="space-y-1">
                      <p className="text-xs text-blue-600 font-medium">1. Save or drag this image into FB Marketplace:</p>
                      <div className="flex gap-2 items-start">
                        <img
                          src={purchase.image_url}
                          alt={purchase.title}
                          className="w-24 h-24 object-cover rounded-lg border border-blue-200 cursor-pointer"
                          title="Right-click → Save image"
                        />
                        <a
                          href={purchase.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 underline flex items-center gap-1 mt-1"
                        >
                          <ExternalLink size={11} /> Open full image
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs text-blue-600 font-medium">2. Copy this description:</p>
                    <pre className="text-xs bg-white border border-blue-100 rounded p-2 whitespace-pre-wrap text-gray-700 font-sans">{buildFbDescription()}</pre>
                    <button
                      onClick={handleCopyDescription}
                      className="text-xs flex items-center gap-1 text-blue-700 border border-blue-300 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                    >
                      {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy Description</>}
                    </button>
                  </div>

                  {fbPrice && (
                    <div className="text-xs text-blue-700">
                      <span className="font-medium">Suggested price: </span>${parseFloat(fbPrice).toFixed(2)}
                    </div>
                  )}

                  <button
                    onClick={handleOpenFbMarketplace}
                    className="w-full text-xs bg-blue-600 text-white py-1.5 rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-1"
                  >
                    <Store size={12} /> Open FB Marketplace
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FB Price Row */}
          {showFbPrice && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-purple-50 rounded-lg">
              <DollarSign size={14} className="text-purple-600" />
              <input
                type="number"
                step="0.01"
                placeholder="FB sale price"
                value={fbPrice}
                onChange={(e) => setFbPrice(e.target.value)}
                className="w-28 text-sm border border-purple-200 rounded-md px-2 py-1 focus:ring-purple-400 focus:border-purple-400"
              />
              <button
                onClick={handleFbPriceSave}
                className="text-xs bg-purple-600 text-white px-3 py-1 rounded-md hover:bg-purple-700 transition-colors"
              >
                {purchase.status === 'sell_fb' ? 'Mark Sold' : 'Update'}
              </button>
              {profit !== null && (
                <span className={`text-sm font-bold ${parseFloat(profit) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {parseFloat(profit) >= 0 ? '+' : ''}${profit}
                </span>
              )}
            </div>
          )}

          {/* Return Panel */}
          {showReturn && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-700 flex items-center gap-1"><RotateCcw size={12} /> Submit Return</span>
                <button onClick={() => { setShowReturn(false); setReturnError(null); }} className="text-red-400 hover:text-red-600"><X size={14} /></button>
              </div>

              {/* Return type */}
              <div className="flex flex-wrap gap-1">
                {RETURN_TYPES.map(rt => (
                  <button
                    key={rt.id}
                    onClick={() => setReturnTypeId(rt.id)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      returnTypeId === rt.id
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-red-600 border-red-300 hover:border-red-500'
                    }`}
                  >
                    {rt.label}
                  </button>
                ))}
              </div>

              {/* Quick reason buttons */}
              <div className="flex flex-wrap gap-1">
                {QUICK_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setReturnReason(reason)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      returnReason === reason
                        ? 'bg-red-100 border-red-400 text-red-800 font-medium'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {/* Custom reason textarea */}
              <textarea
                rows={2}
                placeholder="Or type a custom reason..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full text-xs border border-red-200 rounded-md px-2 py-1.5 focus:ring-red-400 focus:border-red-400 resize-none"
              />

              {returnError && (
                <div className="flex items-center gap-1 text-xs text-red-700">
                  <AlertCircle size={12} /> {returnError}
                </div>
              )}

              <button
                onClick={handleReturnSubmit}
                disabled={returning || !returnReason.trim()}
                className="w-full text-xs bg-red-600 text-white py-1.5 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {returning ? 'Submitting...' : 'Confirm Return Request'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div><span className="font-medium">Product ID:</span> {purchase.product_id}</div>
            <div><span className="font-medium">Condition:</span> {purchase.condition || 'N/A'}</div>
            <div><span className="font-medium">Purchased:</span> {purchase.purchase_date ? new Date(purchase.purchase_date).toLocaleDateString() : 'N/A'}</div>
            {purchase.fb_sold_date && (
              <div><span className="font-medium">FB Sold:</span> {new Date(purchase.fb_sold_date).toLocaleDateString()}</div>
            )}
            {purchase.total_cost > 0 && (
              <>
                <div><span className="font-medium">Bid Amount:</span> ${purchase.purchase_price?.toFixed(2)}</div>
                <div><span className="font-medium">Buyer Premium:</span> ${purchase.buyer_premium?.toFixed(2)} ({purchase.buyer_premium_pct}%)</div>
                <div><span className="font-medium">Tax:</span> ${purchase.tax_amount?.toFixed(2)} ({purchase.tax_pct}%)</div>
                <div><span className="font-medium">Total Cost:</span> ${purchase.total_cost?.toFixed(2)}</div>
              </>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1">
              <MessageSquare size={12} /> Notes
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNotesSave()}
                className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:ring-blue-400 focus:border-blue-400"
              />
              <button
                onClick={handleNotesSave}
                className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors"
              >
                Save
              </button>
            </div>
          </div>

          {/* Product link */}
          <a
            href={`https://nellisauction.com/p/product/${purchase.product_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <ExternalLink size={12} /> View on Nellis Auction
          </a>
        </div>
      )}
    </div>
  );
}
