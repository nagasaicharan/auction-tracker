import PurchaseCard from './PurchaseCard';
import Pagination from './Pagination';
import { Search, Filter, CheckSquare } from 'lucide-react';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'inspected', label: 'Inspected' },
  { value: 'returned', label: 'Returned' },
  { value: 'keep', label: 'Keep' },
  { value: 'sell_fb', label: 'FB Listed' },
  { value: 'sold_fb', label: 'FB Sold' },
];

const BULK_ACTIONS = [
  { value: 'received', label: 'Mark Received' },
  { value: 'inspected', label: 'Mark Inspected' },
  { value: 'keep', label: 'Mark Keep' },
  { value: 'returned', label: 'Mark Returned' },
  { value: 'sell_fb', label: 'List on FB' },
];

export default function PurchaseList({
  purchases, pagination, filters, loading, selected,
  onPageChange, onFilterChange, onUpdate, onToggleSelect, onSelectAll, onBulkUpdate,
}) {
  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search purchases..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={14} className="text-gray-400 mr-1" />
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => onFilterChange({ status: f.value })}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filters.status === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <CheckSquare size={16} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-800">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            {BULK_ACTIONS.map(action => (
              <button
                key={action.value}
                onClick={() => onBulkUpdate(action.value)}
                className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Select all */}
      {purchases.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={selected.size === purchases.length && purchases.length > 0}
            onChange={onSelectAll}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs text-gray-500">Select all on this page</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Empty state */}
      {!loading && purchases.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">No purchases found</p>
          <p className="text-gray-400 text-sm mt-1">Try syncing your purchases or adjusting filters</p>
        </div>
      )}

      {/* Purchase cards */}
      {!loading && (
        <div className="space-y-3">
          {purchases.map(purchase => (
            <PurchaseCard
              key={purchase.id}
              purchase={purchase}
              isSelected={selected.has(purchase.id)}
              onToggleSelect={onToggleSelect}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
}
