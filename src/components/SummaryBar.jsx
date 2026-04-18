import { DollarSign, Package, ShoppingCart, TrendingUp, TrendingDown, RotateCcw, Eye, Heart, Store } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color = 'text-gray-700', bg = 'bg-white' }) {
  return (
    <div className={`${bg} rounded-xl p-4 shadow-sm border border-gray-100`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-gray-50`}>
          <Icon size={20} className={color} />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-lg font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function SummaryBar({ summary }) {
  if (!summary) return null;

  const profit = summary.total_profit;
  const profitColor = profit >= 0 ? 'text-emerald-600' : 'text-red-600';
  const ProfitIcon = profit >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
      <StatCard icon={ShoppingCart} label="Total Items" value={summary.total_items} color="text-blue-600" />
      <StatCard icon={DollarSign} label="Total Spent" value={`$${summary.total_spent.toFixed(2)}`} color="text-orange-600" />
      <StatCard icon={Package} label="Pending" value={summary.pending_count} color="text-yellow-600" />
      <StatCard icon={Eye} label="Received" value={summary.received_count} color="text-indigo-600" />
      <StatCard icon={RotateCcw} label="Returned" value={summary.returned_count} color="text-gray-500" />
      <StatCard icon={RotateCcw} label="Returns Cost" value={`-$${(summary.returned_cost ?? 0).toFixed(2)}`} color="text-red-600" />
      <StatCard icon={Heart} label="Keeping" value={summary.keep_count} color="text-pink-600" />
      <StatCard icon={Store} label="FB Listed" value={summary.sell_fb_count} color="text-purple-600" />
      <StatCard icon={DollarSign} label="FB Sold" value={`${summary.sold_fb_count} ($${summary.total_fb_revenue.toFixed(2)})`} color="text-emerald-600" />
      <StatCard icon={ProfitIcon} label="Net Profit" value={`$${profit.toFixed(2)}`} color={profitColor} />
    </div>
  );
}
