import { useState, useEffect } from 'react';
import { usePurchases } from './hooks/usePurchases';
import { useAppointments } from './hooks/useAppointments';
import SummaryBar from './components/SummaryBar';
import PurchaseList from './components/PurchaseList';
import AppointmentList from './components/AppointmentList';
import SyncButton from './components/SyncButton';
import LoginPage from './components/LoginPage';
import TripAnalytics from './components/TripAnalytics';
import { CalendarClock, Gavel, LogOut, Search, ShoppingCart } from 'lucide-react';
import BidPlayground from './components/BidPlayground';
import SearchAuctionDashboard from './components/SearchAuctionDashboard';
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
  const [activeTab, setActiveTab] = useState('purchases');
  const purchaseHook = usePurchases();
  const appointmentsHook = useAppointments();

  const {
    purchases, pagination, summary, trips, filters, loading, syncing, error, selected,
    goToPage, updateFilters, updatePurchase, bulkUpdate, toggleSelected, selectAll, sync, setTripFilter,
  } = purchaseHook;

  const {
    appointments,
    loading: loadingAppointments,
    error: appointmentsError,
    successMessage,
    slotsByAppointment,
    loadingSlots,
    loadAppointments,
    loadSlots,
    reschedule,
  } = appointmentsHook;

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
            {activeTab === 'purchases' ? (
              <SyncButton onSync={sync} syncing={syncing} />
            ) : activeTab === 'appointments' ? (
              <button
                onClick={loadAppointments}
                className="text-sm bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Refresh appointments
              </button>
            ) : null}
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
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setActiveTab('purchases')}
            className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
              activeTab === 'purchases'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            Purchases
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`text-sm px-3 py-2 rounded-lg border flex items-center gap-1.5 transition-colors ${
              activeTab === 'appointments'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <CalendarClock size={14} />
            Appointments
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`text-sm px-3 py-2 rounded-lg border flex items-center gap-1.5 transition-colors ${
              activeTab === 'search'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Search size={14} />
            Search & Bid
          </button>
          <button
            onClick={() => setActiveTab('bids')}
            className={`text-sm px-3 py-2 rounded-lg border flex items-center gap-1.5 transition-colors ${
              activeTab === 'bids'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Gavel size={14} />
            Bid Playground
          </button>
        </div>

        {activeTab === 'purchases' ? (
          <>
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
          </>
        ) : activeTab === 'appointments' ? (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Want any date? Enter it directly in your local timezone and submit.
            </div>
            {appointmentsError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {appointmentsError}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                {successMessage}
              </div>
            )}
            <AppointmentList
              appointments={appointments}
              loading={loadingAppointments}
              errorMessage={null}
              loadingSlots={loadingSlots}
              slotsByAppointment={slotsByAppointment}
              onLoadSlots={loadSlots}
              onReschedule={reschedule}
            />
          </>
        ) : activeTab === 'search' ? (
          <SearchAuctionDashboard />
        ) : (
          <BidPlayground />
        )}
      </main>
    </div>
  );
}

export default App;
