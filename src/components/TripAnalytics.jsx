import { useState } from 'react';
import { ChevronDown, ChevronUp, Package, TrendingUp, TrendingDown } from 'lucide-react';

export default function TripAnalytics({ trips, activeTripDate, onSelectTrip }) {
  const [open, setOpen] = useState(false);

  if (!trips || trips.length === 0) return null;

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Package size={16} className="text-blue-600" />
          Trip Analytics
          <span className="text-xs font-normal text-gray-400">({trips.length} trips)</span>
          {activeTripDate && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Filtered: {new Date(activeTripDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Trip Date</th>
                <th className="px-3 py-2 text-right">Items</th>
                <th className="px-3 py-2 text-right">Spent</th>
                <th className="px-3 py-2 text-right">Returns</th>
                <th className="px-3 py-2 text-right">Return Cost</th>
                <th className="px-3 py-2 text-right">Keeping</th>
                <th className="px-3 py-2 text-right">Pending</th>
                <th className="px-3 py-2 text-right">FB Sold</th>
                <th className="px-3 py-2 text-right">FB Revenue</th>
                <th className="px-3 py-2 text-right">Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {trips.map(t => {
                const isActive = activeTripDate === t.trip_date;
                const returnRate = t.total_items > 0 ? Math.round((t.returned_count / t.total_items) * 100) : 0;
                const pnlPositive = t.net_profit >= 0;
                const unresolved = t.pending_count + t.received_count;
                const PnlIcon = pnlPositive ? TrendingUp : TrendingDown;

                return (
                  <tr
                    key={t.trip_date}
                    onClick={() => onSelectTrip(isActive ? '' : t.trip_date)}
                    className={`border-t border-gray-100 cursor-pointer transition-colors ${
                      isActive ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      {new Date(t.trip_date + 'T12:00:00').toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                      {isActive && (
                        <span className="ml-1.5 text-blue-500 text-xs">● filtered</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{t.total_items}</td>
                    <td className="px-3 py-2 text-right text-orange-600 font-medium">
                      ${t.total_spent.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={returnRate > 20 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                        {t.returned_count} <span className="text-gray-400">({returnRate}%)</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-red-500 font-medium">
                      {t.returned_cost > 0 ? `-$${t.returned_cost.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-pink-600">{t.keep_count || '—'}</td>
                    <td className="px-3 py-2 text-right text-yellow-600">
                      {unresolved > 0 ? unresolved : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600">{t.sold_fb_count || '—'}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">
                      {t.fb_revenue > 0 ? `$${t.fb_revenue.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`flex items-center justify-end gap-0.5 font-bold ${pnlPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        <PnlIcon size={11} />
                        {pnlPositive ? '+' : ''}${t.net_profit.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {activeTripDate && (
            <div className="px-3 py-2 border-t border-gray-100 bg-blue-50">
              <button
                onClick={() => onSelectTrip('')}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                ✕ Clear trip filter — show all items
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
