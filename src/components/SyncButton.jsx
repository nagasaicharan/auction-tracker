import { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export default function SyncButton({ onSync, syncing }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSync = async () => {
    setResult(null);
    setError(null);
    try {
      const data = await onSync();
      setResult(data);
      setTimeout(() => setResult(null), 8000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 8000);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
      >
        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Syncing...' : 'Sync from Nellis'}
      </button>

      {result && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
          <CheckCircle size={14} />
          <span>Synced {result.synced} items ({result.inserted} new, {result.updated} updated)</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
