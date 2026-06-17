const express = require('express');
const { body, query, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const Appointment = require('../models/Appointment');
const BlockedDate = require('../models/BlockedDate');
const { Op } = require('sequelize');
const ALLOWED_SERVICES = require('../constants/services');
const sendSMS = require('../utils/sendSMS');
const { getNextSerialNumber } = require('../utils/serialNumbers');
const {
  buildSchedule,
  dateKeyFromDateValue,
  generateTimeSlots,
  getAppointmentWindow,
  isBlockingStatus,
  normalizeDateOnly,
  windowsOverlap,
} = require('../utils/schedule');

const router = express.Router();

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

  if (!dayRange || !dateKey) {
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

  return BlockedDate.findOne({
    where: {
      date: {
        [Op.gte]: requestedRange.start,
        [Op.lt]: requestedRange.end,
      },
    },
  });
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

router.get(
  '/availability',
  [
    query('date').isISO8601().withMessage('A valid appointment date is required.'),
    query('service')
      .trim()
      .isIn(ALLOWED_SERVICES)
      .withMessage('Invalid service selected.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { date, service } = req.query;
    const schedule = buildSchedule({ dateValue: date, time: '09:00', service });

    if (!schedule) {
      return res.status(400).json({ error: 'Invalid appointment date or service.' });
    }

    const blockedDate = await findBlockedDate(schedule.dateKey);

    if (blockedDate) {
      return res.json({
        date: schedule.dateKey,
        availableSlots: [],
        bookedSlots: [],
        isDateBlocked: true,
        reason: blockedDate.reason || '',
      });
    }


    const existingAppointments = await findBlockingAppointments(schedule.dateKey);
    const candidateSlots = generateTimeSlots(service);

    // If booking is for today, hide already-passed slots.
    const now = new Date();
    const isToday = schedule.dateKey === dateKeyFromDateValue(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const availableSlots = candidateSlots.filter((slot) => {
      if (isToday) {
        const slotMinutes = (() => {
          const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(slot);
          if (!match) return null;
          const h = Number(match[1]);
          const m = Number(match[2]);
          return h * 60 + m;
        })();

        if (slotMinutes !== null && slotMinutes < nowMinutes) {
          return false;
        }
      }

      const slotWindow = getAppointmentWindow({
        dateKey: schedule.dateKey,
        time: slot,
        service,
      });

      return !existingAppointments.some((appointment) => {
        const existingWindow = getAppointmentWindow(appointment);
        return existingWindow && slotWindow && windowsOverlap(slotWindow, existingWindow);
      });
    });

    res.json({
      date: schedule.dateKey,
      availableSlots,
      bookedSlots: existingAppointments.map((appointment) => appointment.time).filter(Boolean),
      isDateBlocked: false,
    });
  })
);

router.post(
  '/request-otp',

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

    const { number, lastName, firstName, middleInitial, service, email, date, time } =
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    const appointment = await Appointment.create({
      serialNumber: await getNextSerialNumber('appointmentSerial'),
      number,
      lastName,
      firstName,
      middleInitial: middleInitial || '',
      service,
      email: email || '',
      date: schedule.date,
      dateKey: schedule.dateKey,
      time: schedule.time,
      durationMinutes: schedule.durationMinutes,
      scheduledStart: schedule.scheduledStart,
      scheduledEnd: schedule.scheduledEnd,
      otp: otpHash,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000),
    });

    try {
      await sendSMS(number, `Your AppointEase OTP is ${otp}. Valid for 5 minutes.`);
      return res.json({ message: 'OTP sent successfully.' });
    } catch {
      await Appointment.destroy({ where: { id: appointment.id } });
      return res.status(500).json({ error: 'Failed to send OTP.' });
    }
  })
);

router.post(
  '/verify-otp',
  [
    body('number').trim().notEmpty().withMessage('Phone number is required.'),
    body('otp')
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be 6 digits.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { number, otp } = req.body;

    const appointment = await Appointment.findOne({
      where: {
        number,
        otp: { [Op.ne]: null },
        otpExpires: { [Op.gt]: new Date() },
        status: 'pending',
      },
      order: [['createdAt', 'DESC']],
    });

    if (!appointment) {
      return res.status(400).json({ error: 'No pending OTP or OTP expired.' });
    }

    const valid = await bcrypt.compare(otp, appointment.otp);

    if (!valid) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    appointment.otp = null;
    appointment.otpExpires = null;
    appointment.verifiedAt = new Date();
    await appointment.save();

    try {
      await sendSMS(
        number,
        `Booking request received for ${appointment.service}. Please wait for admin approval.`
      );
    } catch {
      // The booking is already queued, so an SMS retry can be handled later without failing the request.
    }

    return res.json({
      message: 'Appointment booked successfully.',
      appointmentId: appointment.id,
      serialNumber: appointment.serialNumber,
    });
  })
);

router.post(
  '/history/request-otp',
  [
    body('number')
      .trim()
      .matches(/^09\d{9}$/)
      .withMessage('Invalid phone number'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { number } = req.body;
    const count = await Appointment.count({ where: { number, otp: null } });

    if (count === 0) {
      return res.status(404).json({ error: 'No appointments found for this number.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
    const latestAppointment = await Appointment.findOne({
      where: { number, otp: null },
      order: [['createdAt', 'DESC']],
    });

    if (latestAppointment) {
      latestAppointment.historyOtp = otpHash;
      latestAppointment.historyOtpExpires = new Date(Date.now() + 5 * 60 * 1000);
      await latestAppointment.save();
    }

    try {
      await sendSMS(number, `Your AppointEase history OTP is ${otp}. Valid for 5 minutes.`);
      return res.json({ message: 'OTP sent to your phone.' });
    } catch {
      return res.status(500).json({ error: 'Failed to send OTP.' });
    }
  })
);

router.post(
  '/history/verify-otp',
  [
    body('number').trim().notEmpty().withMessage('Phone number is required.'),
    body('otp')
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be 6 digits.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { number, otp } = req.body;

    const appointment = await Appointment.findOne({
      where: {
        number,
        historyOtp: { [Op.ne]: null },
        historyOtpExpires: { [Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
    });

    if (!appointment) {
      return res.status(400).json({ error: 'No OTP requested or OTP expired.' });
    }

    const valid = await bcrypt.compare(otp, appointment.historyOtp);

    if (!valid) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    appointment.historyOtp = null;
    appointment.historyOtpExpires = null;
    await appointment.save();

    const appointments = await Appointment.findAll({
      where: { number, otp: null },
      order: [['scheduledStart', 'DESC'], ['createdAt', 'DESC']],
      attributes: { exclude: ['otp', 'otpExpires', 'historyOtp', 'historyOtpExpires'] },
    });

    return res.json({
      appointments: appointments.map((entry) => {
        const data = entry.get({ plain: true });
        return {
          ...data,
          dateKey: data.dateKey || dateKeyFromDateValue(data.date),
          blocksTimeSlot: isBlockingStatus(data.status),
        };
      }),
    });
  })
);

module.exports = router;
