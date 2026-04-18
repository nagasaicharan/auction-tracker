const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'received', label: 'Received', color: 'bg-blue-100 text-blue-800' },
  { value: 'inspected', label: 'Inspected', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'returned', label: 'Returned', color: 'bg-gray-100 text-gray-800' },
  { value: 'keep', label: 'Keep', color: 'bg-pink-100 text-pink-800' },
  { value: 'sell_fb', label: 'List on FB', color: 'bg-purple-100 text-purple-800' },
  { value: 'sold_fb', label: 'Sold on FB', color: 'bg-emerald-100 text-emerald-800' },
];

export function getStatusBadge(status) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

export default function StatusDropdown({ status, onChange }) {
  const current = getStatusBadge(status);

  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs font-medium rounded-full px-3 py-1.5 border-0 cursor-pointer focus:ring-2 focus:ring-blue-300 ${current.color}`}
    >
      {STATUS_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
