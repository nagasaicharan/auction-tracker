import { DollarSign, Package, ShoppingCart, TrendingUp, TrendingDown, RotateCcw, Eye, Heart, Store, Percent } from 'lucide-react';

function StatCard({ icon, label, value, color = 'text-gray-700', bg = 'bg-white' }) {
  const IconComponent = icon;
  return (
    <div className={`${bg} rounded-xl p-4 shadow-sm border border-gray-100`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-gray-50`}>
          <IconComponent size={20} className={color} />
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

  const money = (value) => Number(value || 0);
  const totalItems = money(summary.total_items);
  const totalSpent = money(summary.total_spent);
  const returnedCost = money(summary.returned_cost);
  const effectiveSpent = money(summary.effective_spent_after_returns);
  const keepCost = money(summary.retained_cost);
  const fbRevenue = money(summary.total_fb_revenue);
  const netProfit = money(summary.total_profit);
  const returnRate = money(summary.return_rate_pct);
  const keepRate = totalItems > 0 ? (money(summary.retained_count) / totalItems) * 100 : 0;
  const returnAdjustedROI = effectiveSpent > 0 ? fbRevenue / effectiveSpent : 0;
  const avgCostAfterReturns = money(summary.non_returned_items) > 0 ? effectiveSpent / money(summary.non_returned_items) : 0;
  const avgCostPerKeptItem = money(summary.avg_retained_cost);

  const profitColor = netProfit >= 0 ? 'text-emerald-600' : 'text-red-600';
  const ProfitIcon = netProfit >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
      <StatCard icon={ShoppingCart} label="Total Items" value={summary.total_items} color="text-blue-600" />
      <StatCard icon={DollarSign} label="Total Spent" value={`$${totalSpent.toFixed(2)}`} color="text-orange-600" />
      <StatCard icon={DollarSign} label="Effective Spent" value={`$${effectiveSpent.toFixed(2)}`} color="text-blue-600" />
      <StatCard icon={RotateCcw} label="Return Cost" value={`-$${returnedCost.toFixed(2)}`} color="text-red-600" />
      <StatCard icon={Package} label="Pending" value={summary.pending_count} color="text-yellow-600" />
      <StatCard icon={Eye} label="Received" value={summary.received_count} color="text-indigo-600" />
      <StatCard icon={Package} label="Return Rate" value={`${returnRate.toFixed(1)}%`} color="text-red-500" />
      <StatCard icon={Heart} label="Keeping" value={summary.keep_count} color="text-pink-600" />
      <StatCard icon={DollarSign} label="Keeping Cost" value={`$${keepCost.toFixed(2)}`} color="text-indigo-700" />
      <StatCard icon={Store} label="FB Listed" value={summary.sell_fb_count} color="text-purple-600" />
      <StatCard icon={DollarSign} label="FB Sold" value={`${summary.sold_fb_count} ($${fbRevenue.toFixed(2)})`} color="text-emerald-600" />
      <StatCard icon={Heart} label="Keep Rate" value={`${(keepRate || 0).toFixed(1)}%`} color="text-pink-700" />
      <StatCard icon={Package} label="Cost / Kept Item" value={`$${avgCostPerKeptItem.toFixed(2)}`} color="text-indigo-700" />
      <StatCard icon={Package} label="Cost / Post-Return Item" value={`$${avgCostAfterReturns.toFixed(2)}`} color="text-indigo-800" />
      <StatCard icon={Percent} label="Return-Adjusted Recovery" value={`${(returnAdjustedROI * 100 || 0).toFixed(1)}%`} color="text-emerald-700" />
      <StatCard icon={ProfitIcon} label="Net Profit" value={`$${netProfit.toFixed(2)}`} color={profitColor} />
    </div>
  );
}
