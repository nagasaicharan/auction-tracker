import { useState, useEffect } from 'react';
import { usePurchases } from './hooks/usePurchases';
import SummaryBar from './components/SummaryBar';
import PurchaseList from './components/PurchaseList';
import SyncButton from './components/SyncButton';
import LoginPage from './components/LoginPage';
import TripAnalytics from './components/TripAnalytics';
import { ShoppingCart, LogOut } from 'lucide-react';
import { getAuthStatus, logout } from './api.js';

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    getAuthStatus()
      .then(({ loggedIn }) => setLoggedIn(loggedIn))
      .catch(() => setLoggedIn(false))
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogout = async () => {
    await logout();
    setLoggedIn(false);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return <MainApp onLogout={handleLogout} />;
}

function MainApp({ onLogout }) {
  const {
    purchases, pagination, summary, trips, filters, loading, syncing, error, selected,
    goToPage, updateFilters, updatePurchase, bulkUpdate, toggleSelected, selectAll, sync, setTripFilter,
  } = usePurchases();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart size={24} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Auction Tracker</h1>
          </div>
          <div className="flex items-center gap-3">
            <SyncButton onSync={sync} syncing={syncing} />
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <SummaryBar summary={summary} />

        <TripAnalytics trips={trips} activeTripDate={filters.trip_date} onSelectTrip={setTripFilter} />

        <PurchaseList
          purchases={purchases}
          pagination={pagination}
          filters={filters}
          loading={loading}
          selected={selected}
          onPageChange={goToPage}
          onFilterChange={updateFilters}
          onUpdate={updatePurchase}
          onToggleSelect={toggleSelected}
          onSelectAll={selectAll}
          onBulkUpdate={bulkUpdate}
        />
      </main>
    </div>
  );
}

export default App;
