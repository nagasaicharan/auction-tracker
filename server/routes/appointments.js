import { Router } from 'express';
import { getCookies } from '../cookies.js';
import {
  fetchAppointments,
  fetchAppointmentReschedule,
  submitAppointmentReschedule,
} from '../nellis.js';

const router = Router();

function ensureLoggedIn(req, res, next) {
  const cookies = getCookies();
  if (!cookies || cookies.includes('YOUR_SESSION_COOKIE_HERE')) {
    return res.status(401).json({ error: 'Not logged in — please log in first' });
  }
  req.cookies = cookies;
  next();
}

function normalizeAppointmentRecord(record) {
  return {
    id: record.id,
    statusId: record.appointmentStatusTypeId,
    status: record.appointmentStatusType?.name || 'Unknown',
    time: record.appointmentTime?.value || null,
    timezone: record.location?.timezone || null,
    location: record.location?.name || null,
    address: record.location?.address || null,
    itemCount: Array.isArray(record.buyNows) ? record.buyNows.length : 0,
    items: record.buyNows || [],
    readOnly: Boolean(record.readOnly),
  };
}

// GET /api/appointments
router.get('/', ensureLoggedIn, async (req, res) => {
  const page = parseInt(req.query.page || '0', 10);
  const size = parseInt(req.query.size || '20', 10);
  try {
    const data = await fetchAppointments(req.cookies, page, size);
    const pageData = data.page || {};
    const records = Array.isArray(pageData.records) ? pageData.records : [];

    res.json({
      appointments: records.map(normalizeAppointmentRecord),
      page: {
        page: pageData.page || page,
        size: size,
        total: pageData.total || records.length,
      },
      relistHours: data.relistHours,
    });
  } catch (err) {
    console.error('Appointments fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/:id/slots
router.get('/:id/slots', ensureLoggedIn, async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fetchAppointmentReschedule(req.cookies, id);
    res.json({
      appointmentTime: data.appointment?.appointmentTime?.value || null,
      dateTimeSlots: data.dateTimeSlots || [],
    });
  } catch (err) {
    console.error('Appointment slots error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments/:id/reschedule
router.post('/:id/reschedule', ensureLoggedIn, async (req, res) => {
  const { id } = req.params;
  const { appointmentTime } = req.body;

  if (!appointmentTime) {
    return res.status(400).json({ error: 'appointmentTime is required' });
  }

  try {
    const result = await submitAppointmentReschedule(req.cookies, id, appointmentTime);
    res.json(result);
  } catch (err) {
    console.error('Appointment reschedule error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
