const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Appointment = require('../models/Appointment');
const BlockedDate = require('../models/BlockedDate');
const { Op } = require('sequelize');
const ALLOWED_SERVICES = require('../constants/services');
const auth = require('../middleware/auth');
const sendSMS = require('../utils/sendSMS');
const { getJwtSecret } = require('../utils/jwtSecret');

const { getNextSerialNumber } = require('../utils/serialNumbers');
const { trainLogisticRegression } = require('../utils/logisticRegression');
const {
  buildSchedule,
  dateKeyFromDateValue,
  getAppointmentWindow,
  getTodayDateKey,
  isBlockingStatus,
  normalizeDateOnly,
  windowsOverlap,
} = require('../utils/schedule');

const pad2 = (v) => String(v).padStart(2, '0');
const formatTimeLabel = (time) => {
  if (!time) return 'No time';
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 || 12;
  return `${displayHours}:${pad2(m)} ${suffix}`;
};

const router = express.Router();

const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  notCompleted: 'Not Completed',
  cancelled: 'Cancelled',
};

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const validate = (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }

  return true;
};

const getDayRange = (dateValue) => {
  const start = normalizeDateOnly(dateValue);

  if (!start) {
    return null;
  }


  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const buildDateSelector = (dateValue) => {
  const dateKey = dateKeyFromDateValue(dateValue);
  const dayRange = getDayRange(dateValue);

  if (!dateKey || !dayRange) {
    return null;
  }

  return {
    [Op.or]: [
      { dateKey },
      {
        scheduledStart: {
          [Op.gte]: dayRange.start,
          [Op.lt]: dayRange.end,
        },
      },
      {
        date: {
          [Op.gte]: dayRange.start,
          [Op.lt]: dayRange.end,
        },
      },
    ],
  };
};

const findBlockedDate = async (dateValue) => {
  const requestedRange = getDayRange(dateValue);

  if (!requestedRange) {
    return null;
  }

  return BlockedDate.findOne({ where: { date: { [Op.gte]: requestedRange.start, [Op.lt]: requestedRange.end } } });
};

const findBlockingAppointments = async (dateKey, excludeAppointmentId = null) => {
  const selector = buildDateSelector(dateKey) || { dateKey };

  const where = {
    ...selector,
    status: { [Op.in]: ['accepted', 'completed', 'notCompleted'] },
    time: { [Op.ne]: null },
  };

  if (excludeAppointmentId) {
    where.id = { [Op.ne]: excludeAppointmentId };
  }

  return Appointment.findAll({ where, order: [['scheduledStart', 'ASC'], ['createdAt', 'ASC']] });
};

const findConflictingAppointment = async (appointmentLike, excludeAppointmentId = null) => {
  const requestedWindow = getAppointmentWindow(appointmentLike);

  if (!requestedWindow) {
    return null;
  }

  const appointments = await findBlockingAppointments(
    requestedWindow.dateKey,
    excludeAppointmentId
  );

  return appointments.find((existingAppointment) => {
    const existingWindow = getAppointmentWindow(existingAppointment);
    return existingWindow && windowsOverlap(requestedWindow, existingWindow);
  });
};

const formatName = (appointment) =>
  [appointment.lastName, appointment.firstName, appointment.middleInitial]
    .filter(Boolean)
    .join(', ');

const serializeAppointment = (appointment) => {
  const data = appointment && appointment.get ? appointment.get({ plain: true }) : appointment;
  const appointmentWindow = getAppointmentWindow(data);
  const now = new Date();
  const hasSchedule = Boolean(appointmentWindow);

  return {
    ...data,
    fullName: formatName(data),
    statusLabel: STATUS_LABELS[data.status] || data.status,
    dateKey: data.dateKey || dateKeyFromDateValue(data.date),
    canApprove: data.status === 'pending' && !data.otp && hasSchedule,
    canReject: data.status === 'pending' && !data.otp,
    canMarkOutcome:
      data.status === 'accepted' &&
      Boolean(appointmentWindow && appointmentWindow.scheduledStart <= now),
    blocksTimeSlot: isBlockingStatus(data.status),
  };
};

const sendStatusSms = async (appointment, messageBuilder) => {
  if (!appointment.number) {
    return;
  }

  try {
    await sendSMS(appointment.number, messageBuilder(appointment));
  } catch {
    // Status updates should not fail just because the SMS provider is unavailable.
  }
};

router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { username, password } = req.body;
    const admin = await Admin.findOne({ where: { username } });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const jwtSecret = getJwtSecret();



    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      jwtSecret,
      // Long-lived session: 365 days. (Admin cookies will keep the admin accessible 24/7.)
      { expiresIn: process.env.JWT_EXPIRES_IN || '365d' }
    );



    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('admin_token', token, {
      httpOnly: true,
      path: '/',
      // In dev (HTTP/localhost) use a lax cookie.
      // In production (HTTPS) use SameSite=None + Secure.
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });



    return res.json({ message: 'Login successful.', token });
  })
);

router.post('/logout', auth, (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';

  res.clearCookie('admin_token', {
    httpOnly: true,
    path: '/',
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });


  return res.json({ message: 'Logged out.' });
});

router.get('/check-auth', auth, (req, res) => {
  res.json({ authenticated: true, admin: req.admin });
});

// Auto-mark online appointments that have passed their scheduled time
// and were never marked as completed/notCompleted by the admin.
// Walk-ins are intentionally NOT auto-marked — they remain visible
// in the dashboard's "Pending Outcome" section until the admin
// manually marks them as completed or not completed.
const autoMarkNoShowOnlineAppointments = async () => {
  const now = new Date();

  const overdueOnlineAppointments = await Appointment.findAll({
    where: {
      isWalkIn: false,
      status: 'accepted',
      scheduledEnd: { [Op.lt]: now },
    },
  });

  for (const appointment of overdueOnlineAppointments) {
    appointment.status = 'notCompleted';
    await appointment.save();
  }

  return overdueOnlineAppointments.length;
};

router.get(
  '/dashboard',
  auth,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const todayDateKey = getTodayDateKey();

    // Auto-mark overdue online appointments as not completed (no-show)
    await autoMarkNoShowOnlineAppointments();

    const todaySelector = buildDateSelector(todayDateKey);

    // Compute start of tomorrow to separate today's appointments from upcoming (future dates only)
    const todayStart = normalizeDateOnly(now);
    const startOfTomorrow = todayStart ? new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) : new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [pendingAppointments, todayAppointments, upcomingAppointments, pendingOutcomeAppointments] = await Promise.all([
      Appointment.findAll(
        { where: { status: 'pending', otp: null }, order: [['scheduledStart', 'ASC'], ['createdAt', 'ASC']] }
      ),
      Appointment.findAll({
        where: {
          ...(todaySelector || {}),
          status: { [Op.in]: ['accepted', 'rejected', 'completed', 'notCompleted', 'cancelled'] },
          time: { [Op.ne]: null },
        },
        order: [['scheduledStart', 'ASC'], ['createdAt', 'ASC']],
      }),
      // Upcoming: future dates only (tomorrow onwards), excluding today's appointments.
      // Also includes records that have scheduledStart OR have a dateKey >= tomorrow
      // OR have a raw date field >= tomorrow (for walk-ins that may not have scheduledStart or dateKey set).
      Appointment.findAll({
        where: {
          status: { [Op.in]: ['accepted', 'rejected', 'completed', 'notCompleted', 'cancelled'] },
          time: { [Op.ne]: null },
          otp: null,
          [Op.or]: [
            { scheduledStart: { [Op.gte]: startOfTomorrow } },
            {
              scheduledStart: null,
              dateKey: { [Op.gte]: dateKeyFromDateValue(startOfTomorrow) }
            },
            {
              scheduledStart: null,
              dateKey: null,
              date: { [Op.gte]: startOfTomorrow }
            },
          ],
        },
        order: [['scheduledStart', 'ASC'], ['dateKey', 'ASC'], ['date', 'ASC'], ['time', 'ASC'], ['createdAt', 'ASC']],
        limit: 12,
      }),
      // Pending outcome: walk-in appointments that are still 'accepted' but past
      // their scheduled end time. These should NOT auto-mark — the admin can still
      // manually mark them as completed or not completed so they never disappear.
      // Also include walk-ins with a null scheduledEnd (e.g. schedule builder
      // failed for an out-of-hours time) so they never vanish from the dashboard.
      Appointment.findAll({
        where: {
          isWalkIn: true,
          status: 'accepted',
          [Op.or]: [
            { scheduledEnd: { [Op.lt]: now } },
            { scheduledEnd: null },
          ],
        },
        order: [['scheduledStart', 'ASC'], ['createdAt', 'ASC']],
      }),
    ]);

    const stats = {
      pendingRequests: pendingAppointments.length,
      approvedToday: 0,
      rejectedToday: 0,
      completedToday: 0,
      notCompletedToday: 0,
    };

    todayAppointments.forEach((appointment) => {
      if (appointment.status === 'accepted') {
        stats.approvedToday += 1;
      }
      if (appointment.status === 'rejected') {
        stats.rejectedToday += 1;
      }
      if (appointment.status === 'completed') {
        stats.completedToday += 1;
      }
      if (appointment.status === 'notCompleted') {
        stats.notCompletedToday += 1;
      }
    });

    res.json({
      todayDateKey,
      stats,
      pendingAppointments: pendingAppointments.map(serializeAppointment),
      todayAppointments: todayAppointments.map(serializeAppointment),
      upcomingAppointments: upcomingAppointments.map(serializeAppointment),
      pendingOutcomeAppointments: pendingOutcomeAppointments.map(serializeAppointment),
    });
  })
);

router.get(
  '/history',
  auth,
  [
    query('from').optional().isISO8601().withMessage('Invalid from date.'),
    query('to').optional().isISO8601().withMessage('Invalid to date.'),
    query('status').optional().isIn(['pending', 'accepted', 'rejected', 'completed', 'notCompleted', 'cancelled']).withMessage('Invalid status.'),
    query('phone').optional().isString().withMessage('Invalid phone.'),
    query('search').optional().isString().withMessage('Invalid search.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { from, to, status, phone, search } = req.query;

    // â”€â”€ SEARCH MODE â”€â”€
    // If search text is provided, ignore date filters and search ALL records.
    if (search && search.trim()) {
      const q = search.trim();
      const digits = q.replace(/\D/g, '');

      const allRows = await Appointment.findAll({
        where: { otp: null },
        order: [['scheduledStart', 'DESC'], ['createdAt', 'DESC']],
      });

      // Client-side filter by name or phone
      const matched = allRows.filter((r) => {
        const obj = r.get ? r.get({ plain: true }) : r;
        const name = [obj.firstName, obj.lastName, obj.middleInitial]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const number = String(obj.number || '').toLowerCase();
        if (digits) return number.replace(/\D/g, '').includes(digits) || name.includes(q);
        return name.includes(q) || number.includes(q);
      });

      return res.json({
        appointments: matched.map(serializeAppointment),
      });
    }

    // â”€â”€ NORMAL FILTER MODE â”€â”€
    const digitsOnlyPhone = phone ? String(phone).replace(/\D/g, '').trim() : '';
    const phoneToMatch = digitsOnlyPhone ? digitsOnlyPhone.slice(0, 11) : '';

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    const dateKeyFrom = fromDate ? dateKeyFromDateValue(fromDate) : null;
    const dateKeyTo = toDate ? dateKeyFromDateValue(toDate) : null;

    const where = {
      otp: null,
    };

    if (status) {
      where.status = status;
    } else {
      // Show ALL finalized statuses including accepted (walk-ins) and cancelled
      where.status = { [Op.in]: ['completed', 'notCompleted', 'cancelled', 'accepted', 'rejected'] };
    }

    if (phoneToMatch) {
      where.number = phoneToMatch;
    }

    if (dateKeyFrom && dateKeyTo) {
      where.dateKey = {
        [Op.gte]: dateKeyFrom,
        [Op.lte]: dateKeyTo,
      };
    } else if (fromDate || toDate) {
      const start = fromDate ? new Date(fromDate) : new Date('1970-01-01T00:00:00.000Z');
      const endExclusive = toDate ? new Date(toDate) : new Date('2999-12-31T00:00:00.000Z');
      endExclusive.setDate(endExclusive.getDate() + 1);

      where[Op.and] = [
        {
          [Op.or]: [
            { scheduledStart: { [Op.gte]: start, [Op.lt]: endExclusive } },
            { date: { [Op.gte]: start, [Op.lt]: endExclusive } },
          ],
        },
      ];
    }

    const appointments = await Appointment.findAll({
      where,
      order: [['scheduledStart', 'DESC'], ['createdAt', 'DESC']],
    });

    res.json({
      appointments: appointments.map(serializeAppointment),
    });
  })
);



router.patch(
    '/appointments/:id/status',
  auth,
  [
    // Appointment primary key is a BIGINT (numeric) in this project.
    // Accept numeric ids (stringified numbers from the client) instead of MongoId.
    param('id')
      .isString()
      .matches(/^\d+$/)
      .withMessage('Invalid appointment ID.'),
    body('status')
      .isIn(['accepted', 'rejected', 'completed', 'notCompleted', 'cancelled'])
      .withMessage('Invalid appointment status.'),
    body('rejectionReason')
      .optional()
      .isString()
      .withMessage('Rejection reason must be a string.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const appointment = await Appointment.findByPk(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    if (appointment.otp) {
      return res.status(400).json({ error: 'This booking is still waiting for OTP verification.' });
    }

    const { status, rejectionReason } = req.body;
    const appointmentWindow = getAppointmentWindow(appointment);

    if ((status === 'accepted' || status === 'rejected') && appointment.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending appointments can be approved or rejected.' });
    }

    if ((status === 'completed' || status === 'notCompleted') && appointment.status !== 'accepted') {
      return res.status(400).json({
        error: 'Only approved appointments can be marked as completed or not completed.',
      });
    }

    if ((status === 'completed' || status === 'notCompleted') && !appointmentWindow) {
      return res.status(400).json({ error: 'This appointment does not have a valid schedule yet.' });
    }

    if (
      (status === 'completed' || status === 'notCompleted') &&
      appointmentWindow.scheduledStart > new Date()
    ) {
      return res.status(400).json({
        error: 'You can only mark the appointment outcome when its scheduled time starts.',
      });
    }

    if (status === 'accepted') {
      if (!appointmentWindow) {
        return res.status(400).json({ error: 'This appointment does not have a valid schedule yet.' });
      }

      const blockedDate = await findBlockedDate(appointment.dateKey || appointment.date);

      if (blockedDate) {
        return res.status(400).json({ error: 'This appointment date is currently blocked.' });
      }

      const conflictingAppointment = await findConflictingAppointment(
        {
          dateKey: appointment.dateKey,
          date: appointment.date,
          time: appointment.time,
          service: appointment.service,
          durationMinutes: appointment.durationMinutes,
          scheduledStart: appointment.scheduledStart,
          scheduledEnd: appointment.scheduledEnd,
        },
        appointment.id
      );

      if (conflictingAppointment) {
        return res.status(409).json({
          error: 'Another approved appointment already occupies this time slot.',
        });
      }
    }

    appointment.status = status;
    if (status === 'rejected' && rejectionReason) {
      appointment.rejectionReason = rejectionReason;
    }
    await appointment.save();

    // SMS is only sent for OTP verification, accepted, and rejected statuses.
    // Completed / not completed statuses do NOT send SMS to avoid wasting credits.
    const statusSmsBuilders = {
      accepted: (entry) => {
        const name = formatName(entry);
        return `${name}, your booking has been approved for Dents-City. Date: ${entry.dateKey}, Time: ${formatTimeLabel(
          entry.time
        )}. Thank you.`;
      },
      rejected: (entry) => {
        const reason = entry.rejectionReason ? ` Reason: ${entry.rejectionReason}` : '';
        return `Your appointment on ${entry.dateKey} at ${formatTimeLabel(entry.time)} was rejected.${reason}`;
      },
    };

    const builder = statusSmsBuilders[status];
    if (builder) {
      await sendStatusSms(appointment, builder);
    }

    res.json({
      message: 'Appointment status updated.',
      appointment: serializeAppointment(appointment),
    });
  })
);

router.get(
  '/blocked-dates',
  auth,
  asyncHandler(async (req, res) => {
    // Auto-delete blocked dates that are already past (keeps admin list clean)
    const now = new Date();
    const today = normalizeDateOnly(now);

    await BlockedDate.destroy({
      where: {
        date: {
          [Op.lt]: today,
        },
      },
    });

    const dates = await BlockedDate.findAll({ order: [['date', 'ASC']] });
    res.json(
      dates.map((item) => {
        const data = item.get({ plain: true });
        return {
          ...data,
          dateKey: dateKeyFromDateValue(data.date),
        };
      })
    );
  })
);


router.post(
  '/block-dates',
  auth,
  [
    body('date').isISO8601().withMessage('A valid date is required.'),
    body('confirm').optional().isBoolean().withMessage('Confirm must be a boolean.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { date, reason, confirm } = req.body;
    const normalizedDate = normalizeDateOnly(date);
    const dayRange = getDayRange(date);

    if (!normalizedDate || !dayRange) {
      return res.status(400).json({ error: 'Invalid date.' });
    }

    const existing = await BlockedDate.findOne({ where: { date: { [Op.gte]: dayRange.start, [Op.lt]: dayRange.end } } });

    if (existing) {
      return res.status(400).json({ error: 'Date already blocked or invalid.' });
    }

    const dateKey = dateKeyFromDateValue(normalizedDate);
    const appointmentsOnDate = await Appointment.findAll({
      where: {
        dateKey,
        status: { [Op.not]: 'cancelled' },
      },
      order: [['scheduledStart', 'ASC'], ['createdAt', 'ASC']],
    });

    if (appointmentsOnDate.length > 0 && !confirm) {
      return res.status(409).json({
        error: `There are ${appointmentsOnDate.length} appointment(s) scheduled on ${dateKey}. Please contact the clients before blocking this date.`,
        conflicts: appointmentsOnDate.map((appointment) => ({
          id: appointment.id,
          fullName: formatName(appointment),
          service: appointment.service,
          time: appointment.time,
          status: appointment.status,
          number: appointment.number,
        })),
      });
    }

    const blocked = await BlockedDate.create({ date: normalizedDate, reason: reason || '' });

    const data = blocked.get ? blocked.get({ plain: true }) : blocked;
    return res.status(201).json({
      ...data,
      dateKey: dateKeyFromDateValue(data.date),
    });
  })
);

router.delete('/block-dates/:id', auth, asyncHandler(async (req, res) => {
  await BlockedDate.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Removed.' });
}));

// FLAT clients list: one row per unique person (phone number + name).
// This lets admins see every patient individually — including multiple
// people who share the same phone number. Searching a number now shows
// all the different names tied to it, and names are searchable too.
router.get(
  '/clients',
  auth,
  asyncHandler(async (req, res) => {
    const allAppts = await Appointment.findAll({
      where: { status: { [Op.in]: ANALYTICS_STATUSES } },
      raw: true,
      order: [['scheduledStart', 'DESC'], ['id', 'DESC']]
    });

    // Dedupe by (number + normalized name) so each unique person appears once.
    // Different people sharing the same number each get their own row.
    const seen = new Set();
    const clients = [];

    for (const a of allAppts) {
      const number = a.number || '';
      const firstName = a.firstName || '';
      const lastName = a.lastName || '';
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
      const personKey = number + '|' + displayName.trim().toLowerCase();

      if (seen.has(personKey)) continue;
      seen.add(personKey);

      clients.push({
        id: a.id,
        number,
        firstName,
        lastName,
        fullName: displayName,
        allNames: [displayName, firstName, lastName].filter(Boolean),
        lastAppointment: a.scheduledStart || a.date || a.createdAt,
        appointmentCount: 1,
        service: a.service || '',
        status: a.status || '',
        dateKey: a.dateKey || null,
        createdAt: a.createdAt,
      });
    }

    res.json(clients);
  })
);

// â”€â”€ Client Appointments Endpoint â”€â”€
router.get(
  '/clients/:number/appointments',
  auth,
  asyncHandler(async (req, res) => {
    const rawNumber = req.params.number;
    const cleaned = rawNumber.replace(/\D/g, '');
    
    // Find all appointments matching this phone number (normalize both sides)
    const where = cleaned ? {
      [Op.or]: [
        { number: rawNumber },
        { number: { [Op.like]: `%${cleaned.slice(-10)}%` } },
      ]
    } : { number: rawNumber };

    const appointments = await Appointment.findAll({
      where,
      order: [['scheduledStart', 'DESC'], ['createdAt', 'DESC']],
    });

    res.json({
      appointments: appointments.map(a => {
        const data = a.get ? a.get({ plain: true }) : a;
        const displayName = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Unknown';
        return {
          ...data,
          fullName: displayName,
          dateKey: data.dateKey || dateKeyFromDateValue(data.date),
        };
      }),
    });
  })
);

// â”€â”€ Walk-in Route â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post(
  '/walk-in',
  auth,
  asyncHandler(async (req, res) => {
    const { number, lastName, firstName, middleInitial, service, date, time, email, notes } = req.body;
    
    // Only require essential fields â€” email, notes, middleInitial are optional
    if (!number || !lastName || !firstName || !service || !date || !time) {
      return res.status(400).json({ error: 'Required fields: phone number, last name, first name, service, date, and time.' });
    }

    const raw = String(number).replace(/\D/g, '');
    let e164phone;
    if (/^63\d{10}$/.test(raw)) e164phone = '+' + raw;
    else if (/^09\d{9}$/.test(raw)) e164phone = '+63' + raw.slice(1);
    else if (/^9\d{9}$/.test(raw)) e164phone = '+63' + raw;
    else {
      // Try E.164 normalization via sendSMS utility
      try {
        e164phone = sendSMS.toE164PhStrict(number);
      } catch {
        e164phone = number;
      }
    }

    // Build schedule so the appointment gets proper scheduledStart/scheduledEnd/dateKey/durationMinutes
    const schedule = buildSchedule({ dateValue: date, time, service });

    // Use the dateValue from schedule, but fallback to the raw input
    let dateToUse, dateKeyToUse;
    if (schedule) {
      dateToUse = schedule.date;
      dateKeyToUse = schedule.dateKey;
    } else {
      // If buildSchedule fails (e.g. time outside business hours), 
      // manually compute dateKey from the input date
      dateToUse = normalizeDateOnly(date);
      dateKeyToUse = dateKeyFromDateValue(date);
    }

    const appointment = await Appointment.create({
      number: e164phone,
      lastName,
      firstName,
      middleInitial: middleInitial || '',
      service,
      email: email || '',
      notes: notes || '',
      date: dateToUse || date,
      dateKey: dateKeyToUse || null,
      time: schedule?.time || time,
      durationMinutes: schedule?.durationMinutes || null,
      scheduledStart: schedule?.scheduledStart || null,
      scheduledEnd: schedule?.scheduledEnd || null,
      status: 'accepted',
      isWalkIn: true,
    });

    res.status(201).json({
      message: 'Walk-in appointment created.',
      appointment: appointment.get({ plain: true }),
    });
  })
);

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const toAppointmentDate = (obj) => {
  if (!obj) return null;
  // Try date field (string like "2026-06-26 16:00:00.000 +00:00")
  if (obj.date) {
    const d = new Date(obj.date);
    if (!isNaN(d.getTime())) return d;
  }
  // Try scheduledStart field
  if (obj.scheduledStart) {
    const d = new Date(obj.scheduledStart);
    if (!isNaN(d.getTime())) return d;
  }
  // Try createdAt as fallback
  if (obj.createdAt) {
    const d = new Date(obj.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const ANALYTICS_STATUSES = ['completed', 'notCompleted', 'accepted', 'rejected', 'cancelled'];

// â”€â”€ Analytics Endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get(
  '/analytics',
  auth,
  asyncHandler(async (req, res) => {
    const { type: analysisType, date, month, year } = req.query;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let start, end;
    if (analysisType === 'daily') {
      const d = date ? new Date(date) : new Date(now);
      d.setHours(0, 0, 0, 0);
      start = new Date(d);
      end = new Date(d);
      end.setDate(end.getDate() + 1);
    } else if (analysisType === 'weekly') {
      const d = date ? new Date(date) : new Date(now);
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      start = new Date(d.getFullYear(), d.getMonth(), diff);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
    } else if (analysisType === 'monthly' || analysisType === 'predictive') {
      const m = month !== undefined ? parseInt(month) - 1 : now.getMonth();
      const y = year !== undefined ? parseInt(year) : now.getFullYear();
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 1);
    } else if (analysisType === 'yearly') {
      const y = year !== undefined ? parseInt(year) : now.getFullYear();
      start = new Date(y, 0, 1);
      end = new Date(y + 1, 0, 1);
    } else {
      return res.status(400).json({ error: 'Invalid type. Use daily, weekly, monthly, or yearly.' });
    }

    const rows = await Appointment.findAll({ where: { status: { [Op.in]: ANALYTICS_STATUSES } }, raw: true });

    const appointmentsInRange = rows
      .map((obj) => ({ obj, dt: toAppointmentDate(obj) }))
      .filter((x) => x.dt && x.dt >= start && x.dt < end);

    // â”€â”€ 1. DESCRIPTIVE ANALYTICS (What happened?) â”€â”€
    const pieMap = new Map();
    const lineMap = new Map();
    const barMap = new Map();
    const peakHourMap = new Map();

    if (analysisType === 'yearly') {
      ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].forEach(m => lineMap.set(m, 0));
    } else if (analysisType === 'weekly') {
      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(b => lineMap.set(b, 0));
    } else if (analysisType === 'monthly' || analysisType === 'predictive') {
      const y = start.getFullYear();
      const m0 = start.getMonth();
      const dim = new Date(y, m0+1, 0).getDate();
      for (let d = 1; d <= dim; d++) lineMap.set(String(d), 0);
    } else {
      lineMap.set('Total', 0);
    }

    for (const { obj, dt } of appointmentsInRange) {
      const svc = obj.service || 'Unknown';
      pieMap.set(svc, (pieMap.get(svc) || 0) + 1);

      if (analysisType === 'yearly') {
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        lineMap.set(monthNames[dt.getMonth()], (lineMap.get(monthNames[dt.getMonth()]) || 0) + 1);
      } else if (lineMap.size === 1 && lineMap.has('Total')) {
        lineMap.set('Total', (lineMap.get('Total') || 0) + 1);
      } else if (analysisType === 'weekly') {
        const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        lineMap.set(dayNames[dt.getDay()], (lineMap.get(dayNames[dt.getDay()]) || 0) + 1);
      } else {
        lineMap.set(String(dt.getDate()), (lineMap.get(String(dt.getDate())) || 0) + 1);
      }

      const status = obj.status || 'unknown';
      barMap.set(status, (barMap.get(status) || 0) + 1);

      if (obj.time) {
        const hour = obj.time.split(':')[0];
        peakHourMap.set(hour, (peakHourMap.get(hour) || 0) + 1);
      }
    }

    const pie = Array.from(pieMap.entries()).map(([name, value]) => ({ name, value }));
    const line = Array.from(lineMap.entries()).map(([name, count]) => ({ name, count }));
    const bar = Array.from(barMap.entries()).map(([name, count]) => ({ name, count }));
    const peakHours = Array.from(peakHourMap.entries())
      .map(([hour, count]) => ({ hour: hour + ':00', count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    // â”€â”€ 2. DIAGNOSTIC ANALYTICS (Why did it happen?) â”€â”€
    const dowMap = new Map();
    const serviceDowMap = new Map();
    for (const { obj, dt } of appointmentsInRange) {
      const dow = dt.toLocaleDateString('en-US', { weekday: 'long' });
      dowMap.set(dow, (dowMap.get(dow) || 0) + 1);
      const svc = obj.service || 'Unknown';
      const key = svc + '|' + dow;
      serviceDowMap.set(key, (serviceDowMap.get(key) || 0) + 1);
    }
    const dayOfWeekBreakdown = Array.from(dowMap.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => {
        const order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        return order.indexOf(a.day) - order.indexOf(b.day);
      });

    const serviceDowCorrelation = [];
    for (const [key, count] of serviceDowMap) {
      const [svc, day] = key.split('|');
      serviceDowCorrelation.push({ service: svc, day, count });
    }

    // â”€â”€ 3. PREDICTIVE ANALYTICS (What might happen?) â”€â”€
    let predictiveForecast = [];
    if (analysisType === 'monthly') {
      const threeMonthsAgo = new Date(start);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const historicalRows = rows
        .map((obj) => ({ obj, dt: toAppointmentDate(obj) }))
        .filter((x) => x.dt && x.dt >= threeMonthsAgo && x.dt < start);

      const monthlyCounts = new Map();
      for (const { dt } of historicalRows) {
        const key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
        monthlyCounts.set(key, (monthlyCounts.get(key) || 0) + 1);
      }

      const sortedCounts = Array.from(monthlyCounts.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([, count]) => count);

      const currentCount = appointmentsInRange.length;
      const recentCounts = [...sortedCounts, currentCount].slice(-3);
      const projectedNext = Math.round(
        recentCounts.reduce((sum, value) => sum + value, 0) / Math.max(recentCounts.length, 1)
      );

      const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      predictiveForecast = [
        { period: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), actual: currentCount },
        { period: nextMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), projected: projectedNext },
      ];
    }

    // â”€â”€ 4. PRESCRIPTIVE ANALYTICS (What should we do?) â”€â”€
    const recommendations = [];

    const sortedDow = [...dayOfWeekBreakdown].sort((a, b) => a.count - b.count);
    if (sortedDow.length > 0 && sortedDow[0].count < (appointmentsInRange.length / Math.max(sortedDow.length, 1))) {
      recommendations.push({
        type: 'staffing',
        insight: sortedDow[0].day + ' has the lowest appointment volume (' + sortedDow[0].count + ' bookings). Consider adjusting staff schedules.',
        action: 'Reduce staff on ' + sortedDow[0].day + 's or offer promotions to boost volume.',
        impact: 'Optimize labor costs',
      });
    }

    const busyDow = [...dayOfWeekBreakdown].sort((a, b) => b.count - a.count);
    if (busyDow.length > 0) {
      recommendations.push({
        type: 'capacity',
        insight: busyDow[0].day + ' is the busiest day (' + busyDow[0].count + ' bookings). Ensure full staffing.',
        action: 'Schedule more staff on ' + busyDow[0].day + 's and consider extending hours.',
        impact: 'Reduce wait times, increase patient satisfaction',
      });
    }

    if (peakHours.length > 0) {
      const peak = peakHours[peakHours.length - 1];
      recommendations.push({
        type: 'scheduling',
        insight: 'Peak booking hour is ' + peak.hour + ' with ' + peak.count + ' appointments.',
        action: 'Implement buffer times around ' + peak.hour + ' to manage flow.',
        impact: 'Reduce overbooking and staff burnout',
      });
    }

    const topServices = [...pie].sort((a, b) => b.value - a.value);
    if (topServices.length > 0) {
      recommendations.push({
        type: 'marketing',
        insight: topServices[0].name + ' is the most booked service (' + topServices[0].value + ' bookings).',
        action: 'Feature ' + topServices[0].name + ' in promotions and social media.',
        impact: 'Increase revenue from high-demand service',
      });
    }

    const bottomServices = [...pie].sort((a, b) => a.value - b.value);
    if (bottomServices.length > 0 && bottomServices[0].value < 3) {
      recommendations.push({
        type: 'promotion',
        insight: bottomServices[0].name + ' has low booking volume (' + bottomServices[0].value + ' bookings).',
        action: 'Run a limited-time discount or bundle for ' + bottomServices[0].name + '.',
        impact: 'Increase service awareness and adoption',
      });
    }

    if (predictiveForecast.length >= 3) {
      const last = predictiveForecast[predictiveForecast.length - 1];
      if (last.projected > predictiveForecast[0].actual) {
        recommendations.push({
          type: 'growth',
          insight: 'Appointments are projected to grow to ' + last.projected + ' in ' + last.period + '.',
          action: 'Prepare additional capacity and supplies to meet projected demand.',
          impact: 'Ensure readiness for increased patient volume',
        });
      }
    }

    // â”€â”€ 5. COMPARISON: Period-over-period â”€â”€
    let comparison = null;
    if (analysisType === 'monthly') {
      const prevStart = new Date(start);
      prevStart.setMonth(prevStart.getMonth() - 1);
      const prevEnd = new Date(end);
      prevEnd.setMonth(prevEnd.getMonth() - 1);

      const prevRows = rows
        .map((obj) => ({ obj, dt: toAppointmentDate(obj) }))
        .filter((x) => x.dt && x.dt >= prevStart && x.dt < prevEnd);

      comparison = {
        current: { period: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), count: appointmentsInRange.length },
        previous: { period: prevStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), count: prevRows.length },
        change: prevRows.length > 0 ? Math.round(((appointmentsInRange.length - prevRows.length) / prevRows.length) * 100) : 0,
      };
    } else if (analysisType === 'yearly') {
      const prevStart = new Date(start);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      const prevEnd = new Date(end);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);

      const prevRows = rows
        .map((obj) => ({ obj, dt: toAppointmentDate(obj) }))
        .filter((x) => x.dt && x.dt >= prevStart && x.dt < prevEnd);

      comparison = {
        current: { period: `${start.getFullYear()}`, count: appointmentsInRange.length },
        previous: { period: `${prevStart.getFullYear()}`, count: prevRows.length },
        change: prevRows.length > 0 ? Math.round(((appointmentsInRange.length - prevRows.length) / prevRows.length) * 100) : 0,
      };
    }

    // â”€â”€ 7. REJECTION ANALYSIS (Why are appointments not completed?) â”€â”€
    const rejectionByService = new Map();
    const notCompletedByService = new Map();
    for (const { obj } of appointmentsInRange) {
      const svc = obj.service || 'Unknown';
      if (obj.status === 'rejected') {
        rejectionByService.set(svc, (rejectionByService.get(svc) || 0) + 1);
      }
      if (obj.status === 'notCompleted') {
        notCompletedByService.set(svc, (notCompletedByService.get(svc) || 0) + 1);
      }
    }
    const rejectionAnalysis = {
      rejectedByService: Array.from(rejectionByService.entries())
        .map(([service, count]) => ({ service, count }))
        .sort((a, b) => b.count - a.count),
      notCompletedByService: Array.from(notCompletedByService.entries())
        .map(([service, count]) => ({ service, count }))
        .sort((a, b) => b.count - a.count),
    };

    // â”€â”€ 8. STATUS CHANGE TIMELINE â”€â”€
    const statusTimelineMap = new Map();
    for (const { obj, dt } of appointmentsInRange) {
      if (!dt) continue;
      const dayKey = dateKeyFromDateValue(dt) || String(dt.getDate());
      if (!statusTimelineMap.has(dayKey)) {
        statusTimelineMap.set(dayKey, { date: dayKey, pending: 0, accepted: 0, rejected: 0, completed: 0, notCompleted: 0 });
      }
      const entry = statusTimelineMap.get(dayKey);
      if (entry && obj.status) {
        entry[obj.status] = (entry[obj.status] || 0) + 1;
      }
    }
    const statusTimeline = Array.from(statusTimelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // â”€â”€ 9. SERVICE POPULARITY TREND (month-over-month) â”€â”€
    let serviceTrend = [];
    if (analysisType === 'monthly') {
      const serviceMonthMap = new Map();
      // Go back 6 months for trend
      for (let offset = 5; offset >= 0; offset--) {
        const tm = new Date(start);
        tm.setMonth(tm.getMonth() - offset);
        const key = tm.getFullYear() + '-' + String(tm.getMonth() + 1).padStart(2, '0');
        serviceMonthMap.set(key, new Map());
      }
      // Also add current month
      const currentKey = start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0');
      if (!serviceMonthMap.has(currentKey)) {
        serviceMonthMap.set(currentKey, new Map());
      }

      for (const { obj, dt } of rows.map((obj) => ({ obj, dt: toAppointmentDate(obj) })).filter((x) => x.dt)) {
        const key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
        if (serviceMonthMap.has(key)) {
          const svc = obj.service || 'Unknown';
          const monthMap = serviceMonthMap.get(key);
          monthMap.set(svc, (monthMap.get(svc) || 0) + 1);
        }
      }

      // Build trend array
      const allServices = new Set();
      for (const monthMap of serviceMonthMap.values()) {
        for (const svc of monthMap.keys()) {
          allServices.add(svc);
        }
      }

      serviceTrend = [];
      for (const svc of allServices) {
        const dataPoints = [];
        for (const [period, monthMap] of serviceMonthMap) {
          dataPoints.push({ period, count: monthMap.get(svc) || 0 });
        }
        serviceTrend.push({ service: svc, data: dataPoints });
      }
      serviceTrend.sort((a, b) => {
        const totalA = a.data.reduce((s, d) => s + d.count, 0);
        const totalB = b.data.reduce((s, d) => s + d.count, 0);
        return totalB - totalA;
      });
    }

    // â”€â”€ 10. WALK-IN VS ONLINE BOOKING COMPARISON â”€â”€
    let walkInVsOnline = null;
    {
      const walkInCount = appointmentsInRange.filter(({ obj }) => obj.isWalkIn).length;
      const onlineCount = appointmentsInRange.filter(({ obj }) => !obj.isWalkIn).length;
      walkInVsOnline = {
        walkIn: walkInCount,
        online: onlineCount,
        total: walkInCount + onlineCount,
        walkInPercent: (walkInCount + onlineCount) > 0 ? Math.round((walkInCount / (walkInCount + onlineCount)) * 100) : 0,
        onlinePercent: (walkInCount + onlineCount) > 0 ? Math.round((onlineCount / (walkInCount + onlineCount)) * 100) : 0,
      };
    }

    // â”€â”€ 11. LOGISTIC REGRESSION (Probability of completion) â”€â”€
    // Trains a logistic regression model on the finalized (non-pending)
    // appointments WITHIN the selected date range to estimate the PROBABILITY
    // of completion (0–1), not a hard class label. Returns per-service
    // probabilities, per-day-of-week probabilities, feature importance, and
    // model metrics — all scoped to the chosen period.
    const logisticRegression = trainLogisticRegression(
      appointmentsInRange.map((x) => x.obj)
    );

    res.json({
      descriptive: { pie, line, bar, peakHours },
      diagnostic: { dayOfWeekBreakdown, serviceDowCorrelation },
      predictive: { forecast: predictiveForecast },
      prescriptive: { recommendations },
      comparison,
      rejectionAnalysis,
      statusTimeline,
      serviceTrend,
      walkInVsOnline,
      logisticRegression,
    });
  })
);

module.exports = router;
