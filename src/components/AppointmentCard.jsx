import { useMemo, useState } from 'react';
import { CalendarClock, MapPin, Package, RefreshCw } from 'lucide-react';

function formatDisplayDate(isoString) {
  if (!isoString) return 'Not scheduled';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatToISOForInput(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function AppointmentCard({
  appointment,
  loadingSlots,
  slots,
  onLoadSlots,
  onReschedule,
}) {
  const [manualTime, setManualTime] = useState(formatToISOForInput(appointment.time));
  const [slotTime, setSlotTime] = useState('');
  const [message, setMessage] = useState(null);

  const slotOptions = useMemo(() => {
    return slots?.flatSlots || [];
  }, [slots]);

  const submitManual = async (event) => {
    event.preventDefault();
    if (!manualTime) return;
    setMessage(null);
    try {
      const requestedTime = new Date(manualTime).toISOString();
      await onReschedule(appointment.id, requestedTime);
      setMessage('Rescheduled from custom date/time.');
      setTimeout(() => setMessage(null), 5000);
    } catch {
      // Error is already surfaced in parent state
    }
  };

  const submitSlot = async () => {
    if (!slotTime) return;
    setMessage(null);
    try {
      await onReschedule(appointment.id, slotTime);
      setMessage('Rescheduled from available slot.');
      setTimeout(() => setMessage(null), 5000);
    } catch {
      // Error is already surfaced in parent state
    }
  };

  return (
    <div className="border border-gray-200 bg-white rounded-xl p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
              #{appointment.id}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              appointment.status === 'Scheduled'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {appointment.status}
            </span>
          </div>

          <p className="font-medium text-gray-900 text-sm">
            Current appointment: {formatDisplayDate(appointment.time)}
          </p>

          <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-3">
            <span className="flex items-center gap-1">
              <MapPin size={13} />
              {appointment.location || 'No location'}
            </span>
            <span className="flex items-center gap-1">
              <Package size={13} />
              {appointment.itemCount} items
            </span>
            <span className="flex items-center gap-1">
              <CalendarClock size={13} />
              {appointment.timezone || 'No timezone'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={submitManual} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="text-xs text-gray-600 flex items-center gap-2">
          Pick any date/time:
          <input
            type="datetime-local"
            value={manualTime}
            onChange={(event) => setManualTime(event.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button
          type="submit"
          className="text-sm bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700"
        >
          Reschedule now
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onLoadSlots(appointment.id)}
          className="text-xs border border-gray-300 rounded-md px-3 py-1.5 text-gray-700 hover:bg-gray-50"
        >
          {loadingSlots ? 'Loading slots...' : 'Load available slots'}
        </button>
      </div>

      {slots && slotOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <select
            value={slotTime}
            onChange={(event) => setSlotTime(event.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">Choose a slot</option>
            {slots.dateTimeSlots.map((group) => (
              group.times.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {group.date.label} — {slot.label}
                </option>
              ))
            ))}
          </select>
          <button
            type="button"
            onClick={submitSlot}
            className="text-sm border border-blue-300 text-blue-700 rounded-lg px-3 py-1.5 hover:bg-blue-50"
          >
            {loadingSlots ? <RefreshCw size={14} className="animate-spin" /> : 'Apply selected slot'}
          </button>
        </div>
      )}

      {slots?.error && (
        <p className="mt-2 text-sm text-red-600">{slots.error}</p>
      )}

      {message && (
        <p className="mt-2 text-sm text-emerald-700">{message}</p>
      )}
    </div>
  );
}
