/*
  Reusable "Park Demo" seeding logic.

  Used by both:
    1. `seed_fake_analytics_data.js` (CLI script)
    2. `POST /api/admin/seed-demo` (admin-protected endpoint that seeds the
       LIVE production database the server is connected to)

  The park demo seeds realistic Filipino names + PH mobile prefixes,
  ~90% walk-ins (otp = null -> NO SMS/OTP is ever sent), and backdates
  createdAt/updatedAt into the most recent April-May window.
*/

require('dotenv').config();
const bcrypt = require('bcryptjs');

const { connectDatabase, disconnectDatabase } = require('./database');
const { SERVICES } = require('../constants/services');

const Admin = require('../models/Admin');
const Appointment = require('../models/Appointment');
const Counter = require('../models/Counter');

const {
  BUSINESS_START_HOUR,
  BUSINESS_END_HOUR,
  SLOT_INTERVAL_MINUTES,
} = require('./schedule');

// ── Helpers (exported for the legacy seed script) ───────────────────────────

function pad2(v) {
  return String(v).padStart(2, '0');
}

function minutesToTime(totalMinutes) {
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildScheduled(dateKey, time) {
  const [y, m, day] = dateKey.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, day, hh, mm, 0, 0);
}

function getServiceDurationMinutes(service) {
  const m = String(service).match(/(\d+)\s*min/i);
  if (!m) return 30;
  return Number.parseInt(m[1], 10);
}

function dateKeyFromLocalDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function lastDaysWindow(days, today) {
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

// ── Filipino data pools ─────────────────────────────────────────────────────

const FILIPINO_FIRST_NAMES = [
  'Juan', 'Maria', 'Jose', 'Rosa', 'Andres', 'Cristina', 'Miguel', 'Luz',
  'Ramon', 'Angela', 'Rico', 'Lani', 'Paolo', 'Gina', 'Marco', 'Divina',
  'Noel', 'Aileen', 'Vicente', 'Mylene', 'Rafael', 'Shiela', 'Dennis',
  'Jocelyn', 'Jerome', 'Marites', 'Fernando', 'Cecilia', 'Eduardo', 'Lorna',
  'Christopher', 'Analyn', 'Ernesto', 'Rachelle', 'Roderick', 'Imelda',
  'Christian', 'Grace', 'Dante', 'Rowena', 'Allan', 'Evelyn', 'Antonio',
  'Carol', 'Rogelio', 'Ma. Teresa', 'Ferdinand', 'Angelica', 'Renato', 'Kathleen'
];

const FILIPINO_LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Dela Cruz', 'Garcia',
  'Mendoza', 'Torres', 'Flores', 'Ramos', 'Rivera', 'Aquino', 'Domingo',
  'Villanueva', 'Gonzales', 'Castillo', 'Fernandez', 'Navarro', 'Salazar',
  'Lopez', 'Pascual', 'Marquez', 'Suarez', 'Contreras', 'Diaz', 'Valdez',
  'Tan', 'Lim', 'Chua', 'Uy', 'Co', 'Perez', 'Hernandez', 'Soriano',
  'Manalo', 'Dizon', 'Rosario', 'Barba', 'Serrano', 'Velasco', 'Agustin'
];

const FILIPINO_MIDDLE = ['', '', 'D.', 'R.', 'S.', 'B.', 'M.', 'P.'];

// Real PH mobile prefixes by provider.
const GLOBE_PREFIXES = ['0817','0904','0905','0906','0915','0916','0917','0926','0927','0935','0936','0945','0953','0954','0955','0956','0965','0966','0967','0975','0976','0977','0978','0979','0994','0995','0996','0997'];
const SMART_PREFIXES = ['0813','0907','0908','0909','0910','0911','0912','0913','0914','0918','0919','0920','0921','0922','0923','0924','0925','0928','0929','0930','0931','0938','0939','0940','0942','0943','0946','0947','0948','0949','0950','0951','0960','0961','0962','0963','0968','0969','0970','0981','0989','0998','0999'];
const DITO_PREFIXES = ['0895','0896','0897','0898','0991','0992','0993','0994'];

function generatePhMobile() {
  const provider = Math.random();
  let prefix;
  if (provider < 0.45) prefix = pick(GLOBE_PREFIXES);
  else if (provider < 0.9) prefix = pick(SMART_PREFIXES);
  else prefix = pick(DITO_PREFIXES);
  const suffix = String(randInt(0, 9999999)).padStart(7, '0');
  return `0${prefix}${suffix}`;
}

// ── Park demo seed ──────────────────────────────────────────────────────────

/**
 * Seeds fake "park demo" appointments into the currently configured DB.
 *
 * @param {object} options
 * @param {number} [options.total=70]  Number of appointments (clamped 50-75).
 * @param {boolean} [options.manageConnection=true]
 *   When true, connects/disconnects the DB (CLI usage).
 *   When false, assumes the server already has an open connection (route usage).
 * @returns {Promise<object>} Summary of what was seeded.
 */
async function seedParkDemo({ total = 70, manageConnection = true } = {}) {
  const parkTotal = Math.min(75, Math.max(50, Number(total) || 70));
  const logger = console;

  if (manageConnection) await connectDatabase();

  try {
    // Ensure a default admin exists so login works during demos.
    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const existingAdmin = await Admin.findOne({ where: { username } });
    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      await Admin.create({ username, passwordHash });
    }

    const { Op } = require('sequelize');

    // Always purge previous fake rows first (notes start with [FAKE])
    await Appointment.destroy({ where: { notes: { [Op.like]: '[FAKE]%' } } });

    const today = new Date();
    const { start: windowStart, end: windowEnd } = lastDaysWindow(30, today);
    const fromLabel = dateKeyFromLocalDate(windowStart);
    const toLabel = dateKeyFromLocalDate(windowEnd);
    logger.log(`Park demo: seeding ${parkTotal} appointments from ${fromLabel} to ${toLabel}`);

    // Weighted statuses (heavy on completed / notCompleted / rejected)
    const parkStatuses = [
      'completed','completed','completed','completed','completed',
      'completed','completed','completed','completed',
      'notCompleted','notCompleted','notCompleted','notCompleted','notCompleted',
      'rejected','rejected','rejected','rejected',
      'accepted','accepted',
      'pending'
    ];

    const services = Array.isArray(SERVICES) && SERVICES.length ? SERVICES : [
      'Regular Checkup - 30 min',
      'Teeth Cleaning - 45 min',
      'Tooth Filling - 40 min',
    ];

    const startMin = BUSINESS_START_HOUR * 60;
    const endMin = BUSINESS_END_HOUR * 60;
    const maxStart = endMin - SLOT_INTERVAL_MINUTES;

    // Compute a safe serial-number base so fake records never collide with
    // existing (real) serial numbers.
    const counterId = 'appointmentSerial';
    const serialCounter = await Counter.findByPk(counterId);
    const maxSerial = await Appointment.max('serialNumber');
    const serialBase = Math.max(serialCounter ? serialCounter.seq : 0, maxSerial || 0);

    const appointments = [];

    for (let i = 0; i < parkTotal; i++) {
      const dayOffset = randInt(0, Math.floor((windowEnd - windowStart) / 86400000));
      const d = new Date(windowStart.getTime() + dayOffset * 86400000);
      // Keep outside clinic's closed days: avoid Sundays for variety
      if (d.getDay() === 0) {
        d.setDate(d.getDate() + 1);
        if (d > windowEnd) d.setDate(d.getDate() - 2);
      }

      const dateKey = dateKeyFromLocalDate(d);
      const slotMinutes = randInt(startMin, maxStart);
      const time = minutesToTime(slotMinutes);
      const scheduledStart = buildScheduled(dateKey, time);
      const service = pick(services);
      const durationMinutes = getServiceDurationMinutes(service);
      const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);

      const status = pick(parkStatuses);
      const isWalkIn = Math.random() < 0.9; // ~90% walk-ins

      const firstName = pick(FILIPINO_FIRST_NAMES);
      const lastName = pick(FILIPINO_LAST_NAMES);
      const middleInitial = pick(FILIPINO_MIDDLE);
      const mobile = generatePhMobile();

      // 25% of the time reuse a previous mobile to simulate returning patients.
      const reuseMobile = appointments.length > 0 && Math.random() < 0.25
        ? pick(appointments).number
        : mobile;

      // Backdate timestamps so charts treat these as genuinely historical.
      const createdAt = new Date(scheduledStart.getTime() - randInt(12, 30) * 60 * 1000);
      const updatedAt = status === 'completed' || status === 'notCompleted'
        ? new Date(scheduledEnd.getTime() + randInt(5, 45) * 60 * 1000)
        : new Date(scheduledStart.getTime() + randInt(1, 10) * 60 * 1000);

      appointments.push({
        serialNumber: serialBase + i + 1,
        number: reuseMobile,
        lastName,
        firstName,
        middleInitial: middleInitial || '',
        service,
        email: `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}${randInt(1, 999)}@example.com`,
        notes: `[FAKE] Park demo ${i + 1}`,
        date: new Date(dateKey + 'T00:00:00'),
        dateKey,
        time,
        durationMinutes,
        scheduledStart,
        scheduledEnd,
        status,
        otp: null,
        otpExpires: null,
        verifiedAt: scheduledStart,
        isWalkIn,
        historyOtp: null,
        historyOtpExpires: null,
        createdAt,
        updatedAt,
      });
    }

    await Appointment.bulkCreate(appointments);

    // Update counter (optional)
    const counter = await Counter.findByPk(counterId);
    if (!counter) {
      await Counter.create({ id: counterId, seq: serialBase + parkTotal + 1 });
    } else {
      await counter.update({ seq: Math.max(counter.seq, serialBase + parkTotal + 1) });
    }

    const walkInCount = appointments.filter((a) => a.isWalkIn).length;
    logger.log(`Park demo complete: ${appointments.length} fake appointments (walk-ins: ${walkInCount}).`);
    logger.log('No SMS/OTP was sent — direct DB insert only.');

    return {
      total: appointments.length,
      walkIns: walkInCount,
      from: fromLabel,
      to: toLabel,
      serialStart: serialBase + 1,
      serialEnd: serialBase + appointments.length,
    };
  } finally {
    if (manageConnection) await disconnectDatabase();
  }
}

module.exports = {
  seedParkDemo,
  pad2,
  minutesToTime,
  addDays,
  pick,
  randInt,
  buildScheduled,
  getServiceDurationMinutes,
  dateKeyFromLocalDate,
  lastDaysWindow,
};
