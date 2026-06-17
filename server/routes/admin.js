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
const { getNextSerialNumber } = require('../utils/serialNumbers');
const {
  buildSchedule,
  dateKeyFromDateValue,
  getAppointmentWindow,
  getTodayDateKey,
  isBlockingStatus,
  normalizeDateOnly,
  windowsOverlap,
  timeToMinutes,
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

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.cookie('admin_token', token, {
      httpOnly: true,
      // Ensure cookie is accepted in dev HTTP. (secure cookies are ignored on HTTP.)
      secure: false,
      sameSite: 'lax',

      maxAge: 60 * 60 * 1000,
    });

    return res.json({ message: 'Login successful.' });
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
    const todayDateKey = getTodayDateKey();
    const todaySelector = buildDateSelector(todayDateKey);

    const [pendingAppointments, todayAppointments] = await Promise.all([
      Appointment.findAll({ where: { status: 'pending', otp: null }, order: [['scheduledStart', 'ASC'], ['createdAt', 'ASC']] }),
      Appointment.findAll({ where: { ...(todaySelector || {}), status: { [Op.in]: ['accepted', 'rejected', 'completed', 'notCompleted'] } }, order: [['scheduledStart', 'ASC'], ['createdAt', 'ASC']] }),
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
    });
  })
);

router.patch(
  '/appointments/:id/status',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid appointment ID.'),
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

    if (status === 'accepted') {
      await sendStatusSms(
        appointment,
        (entry) =>
          `Your appointment on ${entry.dateKey} at ${formatTimeLabel(entry.time)} is approved.`
      );
    }

    if (status === 'rejected') {
      await sendStatusSms(
        appointment,
        (entry) =>
          `Your appointment on ${entry.dateKey} at ${formatTimeLabel(entry.time)} was rejected.`
      );
    }


    if (status === 'completed') {
      await sendStatusSms(
        appointment,
        () => 'Your appointment has been marked as completed. Thank you.'
      );
    }

    if (status === 'notCompleted') {
      await sendStatusSms(
        appointment,
        () => 'Your appointment has been marked as not completed. Please contact the clinic if needed.'
      );
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
      if (!prev || appointmentDateTime > prev) {
        map.set(obj.number, appointmentDateTime);
      }
    });

    const clients = Array.from(map.entries()).map(([number, lastAppointment]) => ({ number, lastAppointment }));
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
      .isIn(['daily', 'weekly', 'monthly'])
      .withMessage('Analysis type must be daily, weekly, or monthly.'),
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
    let start, end, dateKey;

    if (analysisType === 'daily') {
      dateKey = req.query.date || dateKeyFromDateValue(now);
      const dayRange = getDayRange(dateKey);
      if (!dayRange) {
        return res.status(400).json({ error: 'Invalid date.' });
      }
      start = dayRange.start;
      end = dayRange.end;
    } else if (analysisType === 'weekly') {
      dateKey = req.query.date || dateKeyFromDateValue(now);
      const [year, month, day] = dateKey.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const firstDay = new Date(date);
      firstDay.setDate(date.getDate() - dayOfWeek);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(firstDay);
      lastDay.setDate(firstDay.getDate() + 6);
      lastDay.setHours(23, 59, 59, 999);
      start = firstDay;
      end = new Date(lastDay);
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
    } else {
      // Monthly (default)
      const year = req.query.year ? Number.parseInt(req.query.year, 10) : now.getFullYear();
      const month = req.query.month ? Number.parseInt(req.query.month, 10) : now.getMonth() + 1;
      start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      end = new Date(year, month, 1, 0, 0, 0, 0);
    }

    const basePipeline = [
      {
        $match: {
          otp: null,
        },
      },
      {
        $addFields: {
          appointmentDateTime: {
            $ifNull: ['$scheduledStart', { $ifNull: ['$date', '$createdAt'] }],
          },
        },
      },
      {
        $match: {
          appointmentDateTime: { $gte: start, $lt: end },
        },
      },
    ];

    // Fetch appointments in range and compute aggregates in JS
    const rows = await Appointment.findAll({ where: { otp: null } });
    const appointmentsInRange = rows.filter((r) => {
      const obj = r.get ? r.get({ plain: true }) : r;
      const appointmentDateTime = obj.scheduledStart || obj.date || obj.createdAt;
      return appointmentDateTime >= start && appointmentDateTime < end;
    });

    const pieMap = new Map();
    const lineMap = new Map();
    const barMap = new Map();

    appointmentsInRange.forEach((r) => {
      const obj = r.get ? r.get({ plain: true }) : r;
      const appointmentDateTime = obj.scheduledStart || obj.date || obj.createdAt;
      // pie (completed by service)
      if (obj.status === 'completed') {
        pieMap.set(obj.service, (pieMap.get(obj.service) || 0) + 1);
      }
      // line
      const day = analysisType === 'daily' ? 'Total' : new Date(appointmentDateTime).getDate();
      lineMap.set(day, (lineMap.get(day) || 0) + 1);
      // bar
      barMap.set(obj.status, (barMap.get(obj.status) || 0) + 1);
    });

    const pie = Array.from(pieMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    const line = Array.from(lineMap.entries()).map(([day, count]) => ({ day, count })).sort((a, b) => (analysisType === 'daily' ? 0 : a.day - b.day));
    const bar = Array.from(barMap.entries()).map(([status, count]) => ({ status, count }));

    res.json({ type: analysisType, month: req.query.month ? Number.parseInt(req.query.month, 10) : undefined, year: req.query.year ? Number.parseInt(req.query.year, 10) : undefined, date: dateKey, pie, line, bar });
  })
);

module.exports = router;
