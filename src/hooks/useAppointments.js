import { useCallback, useEffect, useState } from 'react';
import {
  fetchAppointments as apiFetchAppointments,
  fetchAppointmentSlots,
  rescheduleAppointment as apiRescheduleAppointment,
} from '../api';

function formatInputDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

function parseSlotLabel(slots, value) {
  for (const day of slots) {
    if (!day?.times) continue;
    const match = day.times.find((slot) => slot?.value === value);
    if (match) return match.label;
  }
  return null;
}

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [slotsByAppointment, setSlotsByAppointment] = useState({});
  const [loadingSlots, setLoadingSlots] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchAppointments();
      const nextAppointments = data.appointments || [];
      setAppointments(nextAppointments.map((appointment) => ({
        ...appointment,
        timeLocal: formatInputDateTime(appointment.time),
      })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const loadSlots = useCallback(async (appointmentId) => {
    setLoadingSlots((prev) => ({ ...prev, [appointmentId]: true }));
    setError(null);
    try {
      const data = await fetchAppointmentSlots(appointmentId);
      const dateTimeSlots = Array.isArray(data.dateTimeSlots) ? data.dateTimeSlots : [];
      const flatSlots = dateTimeSlots.flatMap((day) => day.times || []).map((slot) => slot.value);

      setSlotsByAppointment((prev) => ({
        ...prev,
        [appointmentId]: {
          dateTimeSlots,
          flatSlots,
        },
      }));
      return { dateTimeSlots, flatSlots };
    } catch (err) {
      setError(err.message);
      setSlotsByAppointment((prev) => ({
        ...prev,
        [appointmentId]: {
          dateTimeSlots: [],
          flatSlots: [],
          error: err.message,
        },
      }));
      return null;
    } finally {
      setLoadingSlots((prev) => ({ ...prev, [appointmentId]: false }));
    }
  }, []);

  const reschedule = useCallback(async (appointmentId, requestedTime) => {
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await apiRescheduleAppointment(appointmentId, requestedTime);
      setAppointments((prev) => prev.map((appointment) => {
        if (appointment.id !== Number(appointmentId) && appointment.id !== appointmentId) return appointment;
        return {
          ...appointment,
          time: result.appointmentTime || requestedTime,
          timeLocal: formatInputDateTime(result.appointmentTime || requestedTime),
        };
      }));
      setSuccessMessage(`Appointment ${appointmentId} moved to ${new Date(result.appointmentTime || requestedTime).toLocaleString()}`);
      setTimeout(() => setSuccessMessage(null), 5000);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getSlotLabel = useCallback((appointmentId, value) => {
    const slotData = slotsByAppointment[appointmentId];
    if (!slotData?.flatSlots) return null;
    return parseSlotLabel(slotData.dateTimeSlots || [], value);
  }, [slotsByAppointment]);

  return {
    appointments,
    loading,
    error,
    successMessage,
    slotsByAppointment,
    loadingSlots,
    loadAppointments,
    loadSlots,
    reschedule,
    getSlotLabel,
  };
}
