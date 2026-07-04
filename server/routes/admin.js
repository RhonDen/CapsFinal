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
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
  });


  return res.json({ message: 'Logged out.' });
});

router.get('/check-auth', auth, (req, res) => {
  res.json({ authenticated: true, admin: req.admin });
});

router.get(
  '/dashboard',
  auth,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const todayDateKey = getTodayDateKey();

    const todaySelector = buildDateSelector(todayDateKey);

    const [pendingAppointments, todayAppointments, upcomingAppointments] = await Promise.all([
      Appointment.findAll(
        { where: { status: 'pending', otp: null }, order: [['scheduledStart', 'ASC'], ['createdAt', 'ASC']] }
      ),
      Appointment.findAll({
        where: {
          ...(todaySelector || {}),
          status: { [Op.in]: ['accepted', 'rejected', 'completed', 'notCompleted'] },
          time: { [Op.ne]: null },
        },
        order: [['scheduledStart', 'ASC'], ['createdAt', 'ASC']],
      }),
      // Upcoming: next closest scheduled appointments (approved-only), starting from now.
      Appointment.findAll({
        where: {
          status: { [Op.in]: ['accepted', 'rejected', 'completed', 'notCompleted'] },
          time: { [Op.ne]: null },
          scheduledStart: { [Op.gte]: now },
          otp: null,
        },
        order: [['scheduledStart', 'ASC'], ['createdAt', 'ASC']],
        limit: 12,
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
    });
  })
);

router.get(
  '/history',
  auth,
  [
    query('from').optional().isISO8601().withMessage('Invalid from date.'),
    query('to').optional().isISO8601().withMessage('Invalid to date.'),
    query('status').optional().isIn(['pending', 'accepted', 'rejected', 'completed', 'notCompleted']).withMessage('Invalid status.'),
    query('phone').optional().isString().withMessage('Invalid phone.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { from, to, status, phone } = req.query;

    const digitsOnlyPhone = phone ? String(phone).replace(/\D/g, '').trim() : '';
    const phoneToMatch = digitsOnlyPhone ? digitsOnlyPhone.slice(0, 11) : '';

    // Normalize date range:
    // - 'to' is treated as inclusive day, so we use endExclusive = startOfNextDay.
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    const dateKeyFrom = fromDate ? dateKeyFromDateValue(fromDate) : null;
    const dateKeyTo = toDate ? dateKeyFromDateValue(toDate) : null;

    // If dateKeyFrom/dateKeyTo fail, fall back to scheduledStart/date filtering in a safe way.
    // Primary filtering uses dateKey (YYYY-MM-DD lexical range works).
    const where = {
      otp: null,
    };

    // History should only include "outcomes" by default:
    // - completed
    // - notCompleted
    // If the admin explicitly selects a status filter, respect it.
    if (status) {
      where.status = status;
    } else {
      where.status = { [Op.in]: ['completed', 'notCompleted'] };
    }

    if (phoneToMatch) {
      // Exact match on the stored number (after client strips non-digits).
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

      // Make endExclusive inclusive of the whole day.
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
      .isIn(['accepted', 'rejected', 'completed', 'notCompleted'])
      .withMessage('Invalid appointment status.'),
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

    const { status } = req.body;
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
    await appointment.save();

    const statusSmsBuilders = {
      accepted: (entry) => {
        const name = formatName(entry);
        return `Knorkubs, Liuh F Your booking has been approved for Dents-City. Date: ${entry.dateKey}, Time: ${formatTimeLabel(
          entry.time
        )}. Thank you.`;
      },
      rejected: (entry) =>
        `Your appointment on ${entry.dateKey} at ${formatTimeLabel(entry.time)} was rejected.`,
      completed: () => 'Your appointment has been marked as completed. Thank you.',
      notCompleted: () =>
        'Your appointment has been marked as not completed. Please contact the clinic if needed.',
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
  [body('date').isISO8601().withMessage('A valid date is required.')],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { date, reason } = req.body;
    const normalizedDate = normalizeDateOnly(date);
    const dayRange = getDayRange(date);

    if (!normalizedDate || !dayRange) {
      return res.status(400).json({ error: 'Invalid date.' });
    }

    const existing = await BlockedDate.findOne({ where: { date: { [Op.gte]: dayRange.start, [Op.lt]: dayRange.end } } });

    if (existing) {
      return res.status(400).json({ error: 'Date already blocked or invalid.' });
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

router.get(
  '/clients',
  auth,
  asyncHandler(async (req, res) => {
    // Build clients list by fetching appointments and reducing in JS
    const rows = await Appointment.findAll({ where: { otp: null } });
    const map = new Map();

    rows.forEach((r) => {
      const obj = r.get ? r.get({ plain: true }) : r;
      const appointmentDateTime = obj.scheduledStart || obj.date || obj.createdAt;

      const prev = map.get(obj.number);
      if (!prev || appointmentDateTime > prev.lastAppointment) {
        map.set(obj.number, {
          number: obj.number,
          lastAppointment: appointmentDateTime,
          firstName: obj.firstName,
          lastName: obj.lastName,
          middleInitial: obj.middleInitial,
        });
      }
    });

    const clients = Array.from(map.values()).map((c) => ({
      number: c.number,
      lastAppointment: c.lastAppointment,
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      middleInitial: c.middleInitial || '',
      fullName: [c.lastName, c.firstName, c.middleInitial].filter(Boolean).join(', '),
    }));

    clients.sort((a, b) => new Date(b.lastAppointment) - new Date(a.lastAppointment));
    res.json(clients);
  })
);

router.post(
  '/walk-in',
  auth,
  [
    body('number')
      .trim()
      .matches(/^09\d{9}$/)
      .withMessage('Invalid phone number'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.'),
    body('firstName').trim().notEmpty().withMessage('First name is required.'),
    body('middleInitial')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 1 })
      .withMessage('Middle initial must be one character only.'),
    body('service')
      .trim()
      .isIn(ALLOWED_SERVICES)
      .withMessage('Invalid service selected.'),
    body('email')
      .optional({ values: 'falsy' })
      .trim()
      .isEmail()
      .withMessage('Invalid email address.'),
    body('notes').optional({ values: 'falsy' }).trim(),
    body('date').isISO8601().withMessage('A valid appointment date is required.'),
    body('time')
      .trim()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage('A valid appointment time is required.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { number, lastName, firstName, middleInitial, service, email, notes, date, time } =
      req.body;

    const schedule = buildSchedule({ dateValue: date, time, service });

    if (!schedule) {
      return res.status(400).json({
        error: 'Appointment time must be within clinic hours and follow 15-minute slots.',
      });
    }

    const blockedDate = await findBlockedDate(schedule.dateKey);

    if (blockedDate) {
      return res.status(400).json({ error: 'Selected date is blocked.' });
    }

    const conflictingAppointment = await findConflictingAppointment(schedule);

    if (conflictingAppointment) {
      return res.status(400).json({
        error: 'Selected time is no longer available for that date.',
      });
    }

    const appointment = new Appointment({
      serialNumber: await getNextSerialNumber('appointmentSerial'),
      number,
      lastName,
      firstName,
      middleInitial: middleInitial || '',
      service,
      email: email || '',
      notes: notes || '',
      date: schedule.date,
      dateKey: schedule.dateKey,
      time: schedule.time,
      durationMinutes: schedule.durationMinutes,
      scheduledStart: schedule.scheduledStart,
      scheduledEnd: schedule.scheduledEnd,
      verifiedAt: new Date(),
      status: 'accepted',
      isWalkIn: true,
    });

    await appointment.save();
    return res.status(201).json({
      message: 'Walk-in appointment created.',
      appointment: serializeAppointment(appointment),
    });
  })
);

router.get(
  '/analytics',
  auth,
  [
    query('type')
      .optional()
      .isIn(['daily', 'weekly', 'monthly', 'predictive'])
      .withMessage('Analysis type must be daily, weekly, monthly, or predictive.'),
    query('month')
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage('Month must be between 1 and 12.'),
    query('year')
      .optional()
      .isInt({ min: 2000, max: 9999 })
      .withMessage('Year must be a valid positive number.'),
    query('date')
      .optional()
      .isISO8601()
      .withMessage('Date must be a valid ISO8601 date.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const now = new Date();
    const analysisType = req.query.type || 'monthly';

    const toAppointmentDate = (obj) => {
      const raw = obj?.scheduledStart || obj?.date || obj?.createdAt;
      const d = raw ? new Date(raw) : null;
      return d && !Number.isNaN(d.getTime()) ? d : null;
    };

    const getPredictiveTargetMonth = () => {
      const year = req.query.year ? Number.parseInt(req.query.year, 10) : now.getFullYear();
      const monthBase = req.query.month ? Number.parseInt(req.query.month, 10) : now.getMonth() + 1; // selected month
      const next = monthBase + 1; // next month
      let y = year;
      let m = next;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      return { year: y, month: m };
    };

    const computeRange = () => {
      if (analysisType === 'daily') {
        const dk = req.query.date || dateKeyFromDateValue(now);
        const dayRange = getDayRange(dk);
        if (!dayRange) return { start: null, end: null, dateKey: dk };
        return { start: dayRange.start, end: dayRange.end, dateKey: dk };
      }

      if (analysisType === 'weekly') {
        const dk = req.query.date || dateKeyFromDateValue(now);
        const [y, m, d] = dk.split('-').map(Number);
        const dt = new Date(y, m - 1, d);

        // Mon..Sun week
        const jsDay = dt.getDay(); // 0 Sun .. 6 Sat
        const mondayOffset = (jsDay + 6) % 7; // Mon=0
        const firstDay = new Date(dt);
        firstDay.setDate(dt.getDate() - mondayOffset);
        firstDay.setHours(0, 0, 0, 0);

        const nextMondayExclusive = new Date(firstDay);
        nextMondayExclusive.setDate(firstDay.getDate() + 7);
        nextMondayExclusive.setHours(0, 0, 0, 0);

        return { start: firstDay, end: nextMondayExclusive, dateKey: dk };
      }

      if (analysisType === 'monthly') {
        const y = req.query.year ? Number.parseInt(req.query.year, 10) : now.getFullYear();
        const m = req.query.month ? Number.parseInt(req.query.month, 10) : now.getMonth() + 1;
        const dateKey = `${y}-${String(m).padStart(2, '0')}-01`;
        return { start: new Date(y, m - 1, 1, 0, 0, 0, 0), end: new Date(y, m, 1, 0, 0, 0, 0), dateKey };
      }

      // predictive (next month of selected month/year)
      const { year: ty, month: tm } = getPredictiveTargetMonth();
      const dateKey = `${ty}-${String(tm).padStart(2, '0')}-01`;
      return { start: new Date(ty, tm - 1, 1, 0, 0, 0, 0), end: new Date(ty, tm, 1, 0, 0, 0, 0), dateKey };
    };

    const { start, end, dateKey } = computeRange();
    if (!start || !end) {
      return res.status(400).json({ error: 'Invalid range.' });
    }

    const rows = await Appointment.findAll({ where: { otp: null } });

    const appointmentsInRange = rows
      .map((r) => (r.get ? r.get({ plain: true }) : r))
      .map((obj) => ({ obj, dt: toAppointmentDate(obj) }))
      .filter((x) => x.dt && x.dt >= start && x.dt < end);

    const pieMap = new Map(); // completed by service
    const lineMap = new Map(); // day buckets for chart
    const barMap = new Map(); // status distribution
    const peakHourMap = new Map(); // 0..23

    // Seed buckets so weekly/monthly sums/axes are consistent
    if (analysisType === 'weekly') {
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((b) => lineMap.set(b, 0));
    } else if (analysisType === 'monthly' || analysisType === 'predictive') {
      const y = start.getFullYear();
      const m0 = start.getMonth();
      const daysInMonth = new Date(y, m0 + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d += 1) lineMap.set(String(d), 0);
    } else if (analysisType === 'daily') {
      lineMap.set('Total', 0);
    }

    const weekdayMonFirst = (d) => {
      const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const lab = labels[d.getDay()];
      const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return order.includes(lab) ? lab : 'Sun';
    };

    appointmentsInRange.forEach(({ obj, dt }) => {
      if (obj.status === 'completed') {
        pieMap.set(obj.service, (pieMap.get(obj.service) || 0) + 1);
      }

      if (analysisType === 'daily') {
        lineMap.set('Total', (lineMap.get('Total') || 0) + 1);
      } else if (analysisType === 'weekly') {
        const label = weekdayMonFirst(dt);
        lineMap.set(label, (lineMap.get(label) || 0) + 1);
      } else {
        lineMap.set(String(dt.getDate()), (lineMap.get(String(dt.getDate())) || 0) + 1);
      }

      barMap.set(obj.status, (barMap.get(obj.status) || 0) + 1);

      const hour = dt.getHours();
      peakHourMap.set(hour, (peakHourMap.get(hour) || 0) + 1);
    });

    const pie = Array.from(pieMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

    const line = Array.from(lineMap.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => {
        if (analysisType === 'weekly') {
          const order = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
          return (order[a.day] || 0) - (order[b.day] || 0);
        }
        if (analysisType === 'daily') return 0;
        return Number(a.day) - Number(b.day);
      });

    const bar = Array.from(barMap.entries()).map(([status, count]) => ({ status, count }));

    const peakHours = Array.from(peakHourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count || a.hour - b.hour)
      .slice(0, 6);

    let predictivePie = undefined;

    if (analysisType === 'predictive') {
      // forecast next month totals using previous 28 days completed average per service
      const { year: ty, month: tm } = getPredictiveTargetMonth();
      const targetStart = new Date(ty, tm - 1, 1, 0, 0, 0, 0);
      const targetEnd = new Date(ty, tm, 1, 0, 0, 0, 0);

      const histEnd = new Date(targetStart);
      const histStart = new Date(targetStart);
      histStart.setDate(histStart.getDate() - 28);

      const completedHistory = rows
        .map((r) => (r.get ? r.get({ plain: true }) : r))
        .map((obj) => ({ obj, dt: toAppointmentDate(obj) }))
        .filter((x) => x.dt && x.dt >= histStart && x.dt < histEnd && x.obj?.status === 'completed');

      const daysTarget = Math.max(
        1,
        Math.round((targetEnd.getTime() - targetStart.getTime()) / (24 * 60 * 60 * 1000))
      );
      const scale = daysTarget / 28;

      const totals28 = new Map();
      completedHistory.forEach(({ obj }) => {
        totals28.set(obj.service, (totals28.get(obj.service) || 0) + 1);
      });

      predictivePie = Array.from(totals28.entries())
        .map(([service, total28]) => ({
          name: service,
          value: Math.max(0, Math.round(total28 * scale)),
        }))
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

      // include all known services
      if (Array.isArray(ALLOWED_SERVICES)) {
        ALLOWED_SERVICES.forEach((s) => {
          if (!predictivePie.some((x) => x.name === s)) predictivePie.push({ name: s, value: 0 });
        });
        predictivePie.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
      }
    }

    res.json({
      type: analysisType,
      month: req.query.month ? Number.parseInt(req.query.month, 10) : undefined,
      year: req.query.year ? Number.parseInt(req.query.year, 10) : undefined,
      date: dateKey,
      pie,
      line,
      bar,
      peakHours,
      predictivePie,
    });
  })
);

module.exports = router;
