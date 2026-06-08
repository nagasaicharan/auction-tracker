import { useState } from 'react';
import { Send } from 'lucide-react';
import { testBid } from '../api';

export default function BidPlayground() {
  const [productId, setProductId] = useState('');
  const [bid, setBid] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!productId || !bid) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setResponse(null);

    try {
      const result = await testBid({
        productId: Number(productId),
        bid: Number(bid),
        recaptchaToken: recaptchaToken || null,
      });
      setSuccess('Bid request accepted by Nellis API');
      setResponse(result);
    } catch (err) {
      setError(err.message);
      setResponse(err.payload || null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm text-gray-600 mb-4">
        Use this safe tester to validate bid constraints (for example, sending intentionally low bids).
      </p>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs text-gray-600">
          Product ID
          <input
            type="number"
            min="1"
            required
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ex. 12345678"
          />
        </label>

        <label className="text-xs text-gray-600">
          Bid amount
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={bid}
            onChange={(event) => setBid(event.target.value)}
            className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ex. 42.00"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="self-end h-10 px-3 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            <Send size={15} />
            {loading ? 'Sending…' : 'Send Test Bid'}
          </span>
        </button>
      </form>

      <label className="text-xs text-gray-600 block mt-3">
        Optional recaptchaToken
        <input
          type="text"
          value={recaptchaToken}
          onChange={(event) => setRecaptchaToken(event.target.value)}
          className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Leave blank for baseline tests"
        />
      </label>

      {success && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">
          {success}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {response && (
        <pre className="mt-4 text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-auto">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  );
}
