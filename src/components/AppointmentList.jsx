import AppointmentCard from './AppointmentCard';

export default function AppointmentList({
  appointments,
  loading,
  errorMessage,
  loadingSlots,
  slotsByAppointment,
  onLoadSlots,
  onReschedule,
}) {
  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        Loading appointments...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        {errorMessage}
      </div>
    );
  }

  if (!appointments.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        No appointments found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          loadingSlots={loadingSlots[appointment.id]}
          slots={slotsByAppointment[appointment.id]}
          onLoadSlots={onLoadSlots}
          onReschedule={onReschedule}
        />
      ))}
    </div>
  );
}
