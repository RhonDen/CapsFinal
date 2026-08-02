/*
  Seed fake analytics data for admin dashboard.

  Modes:
  A) "Park Demo" (DEFAULT when SEED_PARK_MODE=true):
     - Seeds the most recent past April-May window (defaults computed from today).
     - Uses realistic Filipino names + real PH mobile prefixes (Globe/Smart/DITO).
     - ~90% walk-ins, otp=null (NO SMS / OTP is ever sent — direct DB insert only).
     - Status mix: completed ~45%, notCompleted ~25%, rejected ~20%,
       accepted ~7%, pending ~3%.
     - Default total = 70 (range 50-75). Set SEED_PARK_TOTAL to override.
     - createdAt/updatedAt are backdated to the scheduled date so records look
       genuinely historical to the admin charts.

  B) Legacy (existing behavior):
     - Seeds last N days with generic names. Enabled via
       SEED_FAKE_APPOINTMENTS_ENABLED=true.

  Usage (park demo):
     cd d:/React-Projects/capsproj/server
     node seed_fake_analytics_data.js

  It writes to whichever DB the app is configured to (SQLite local or Postgres/Neon).
  Set SEED_PARK_MODE=true to enable the park demo (the script refuses to run the
  park demo WITHOUT this flag so it can never clobber real data accidentally).

  Cleanup:
     node seed_fake_analytics_data.js  (with SEED_FAKE_APPOINTMENTS_PURGE_ONLY=true)
     deletes only rows whose notes start with [FAKE].
*/

require('dotenv').config();

const bcrypt = require('bcryptjs');

const { connectDatabase, disconnectDatabase } = require('./utils/database');
const { SERVICES } = require('./constants/services');

const Admin = require('./models/Admin');
const Appointment = require('./models/Appointment');
const BlockedDate = require('./models/BlockedDate');
const Counter = require('./models/Counter');

const {
  BUSINESS_START_HOUR,
  BUSINESS_END_HOUR,
  SLOT_INTERVAL_MINUTES,
  dateKeyFromDateValue,
} = require('./utils/schedule');

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

function formatTimeForDateKey(scheduledStart) {
  return `${pad2(scheduledStart.getHours())}:${pad2(scheduledStart.getMinutes())}`;
}

function dateKeyFromLocalDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function lastAprilMayWindow(today) {
  const year = today.getFullYear();
  let aprilStart = new Date(year, 3, 1); // April 1
  let mayEnd = new Date(year, 4, 31, 23, 59, 59); // May 31

  // If today is before June, use last year's April-May window.
  if (today < aprilStart) {
    aprilStart = new Date(year - 1, 3, 1);
    mayEnd = new Date(year - 1, 4, 31, 23, 59, 59);
  }

  return { start: aprilStart, end: mayEnd };
}

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

// Real PH mobile prefixes by provider (from user-provided list).
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

async function main() {
  const totalDefault = Number(process.env.SEED_FAKE_APPOINTMENTS_TOTAL || 50);

  // ── Park demo mode ──────────────────────────────────────────────────────────
  const parkMode = String(process.env.SEED_PARK_MODE || '').toLowerCase() === 'true';
  const parkTotal = Math.min(75, Math.max(50, Number(process.env.SEED_PARK_TOTAL || 70)));

  await connectDatabase();

  // Ensure default admin exists (so login works during demos)
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

  const purgeOnly = String(process.env.SEED_FAKE_APPOINTMENTS_PURGE_ONLY || '').toLowerCase() === 'true';
  if (purgeOnly) {
    console.log('Purged fake appointments only (notes starting with [FAKE]).');
    await disconnectDatabase();
    return;
  }

  if (parkMode) {
    // ── PARK DEMO: fake "we brought the system to a park" data ────────────────
    const today = new Date();
    const { start: aprStart, end: mayEnd } = lastAprilMayWindow(today);
    const aprLabel = dateKeyFromLocalDate(aprStart);
    const mayLabel = dateKeyFromLocalDate(mayEnd);
    console.log(`Park demo: seeding ${parkTotal} appointments from ${aprLabel} to ${mayLabel}`);

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
    // existing (real) serial numbers. Uses both the Counter and the current max.
    const counterId = 'appointmentSerial';
    const serialCounter = await Counter.findByPk(counterId);
    const maxSerial = await Appointment.max('serialNumber');
    const serialBase = Math.max(serialCounter ? serialCounter.seq : 0, maxSerial || 0);

    const appointments = [];

    for (let i = 0; i < parkTotal; i++) {
      const dayOffset = randInt(0, Math.floor((mayEnd - aprStart) / 86400000));
      const d = new Date(aprStart.getTime() + dayOffset * 86400000);
      // Keep outside clinic's closed days: avoid Sundays for variety
      if (d.getDay() === 0) {
        d.setDate(d.getDate() + 1);
        if (d > mayEnd) d.setDate(d.getDate() - 2);
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

      // 60% of the time reuse a previous mobile to simulate returning patients.
      const reuseMobile = appointments.length > 0 && Math.random() < 0.6
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
    console.log(`Park demo complete: ${appointments.length} fake appointments (walk-ins: ${walkInCount}).`);
    console.log(`No SMS/OTP was sent — direct DB insert only (${walkInCount} walk-ins, ${appointments.length - walkInCount} online).`);

    await disconnectDatabase();
    return;
  }

  // ── Legacy mode (unchanged behavior) ────────────────────────────────────────
  const daysBack = Number(process.env.SEED_FAKE_APPOINTMENTS_DAYS_BACK || 20);
  const enabled = String(process.env.SEED_FAKE_APPOINTMENTS_ENABLED || '').toLowerCase() === 'true';

  if (!enabled) {
    console.log('SEED_FAKE_APPOINTMENTS_ENABLED is not true; skipping fake appointment seeding. (Use SEED_PARK_MODE=true for the park demo.)');
    await disconnectDatabase();
    return;
  }

  const doBlockedDates = String(process.env.SEED_FAKE_BLOCKED_DATES || 'true') === 'true';
  if (doBlockedDates) {
    for (let i = 0; i < 3; i++) {
      const d = addDays(new Date(), -randInt(0, daysBack));
      const dateKey = dateKeyFromDateValue(d);
      if (!dateKey) continue;
      const normalized = new Date(`${dateKey}T00:00:00.000Z`);
      await BlockedDate.findOrCreate({
        where: { date: normalized },
        defaults: { date: normalized, reason: 'Demo blocked date' },
      });
    }
  }

  const statuses = ['pending', 'accepted', 'rejected', 'completed', 'notCompleted'];
  const statusWeights = {
    pending: 0.25,
    accepted: 0.25,
    rejected: 0.15,
    completed: 0.2,
    notCompleted: 0.15,
  };

  const services = Array.isArray(SERVICES) && SERVICES.length ? SERVICES : [
    'Regular Checkup - 30 min',
    'Teeth Cleaning - 45 min',
    'Tooth Filling - 40 min',
  ];

  function weightedStatus() {
    const r = Math.random();
    let acc = 0;
    for (const s of statuses) {
      acc += statusWeights[s] || 0;
      if (r <= acc) return s;
    }
    return 'accepted';
  }

  console.log(`Legacy mode: seeding ~${totalDefault} appointments over the last ${daysBack} days.`);
  const appointments = [];

  const startMin = BUSINESS_START_HOUR * 60;
  const endMin = BUSINESS_END_HOUR * 60;
  const maxStart = endMin - SLOT_INTERVAL_MINUTES;

  for (let i = 0; i < totalDefault; i++) {
    const dayOffset = randInt(0, daysBack);
    const d = addDays(new Date(), -dayOffset);
    const dateKey = dateKeyFromDateValue(d);
    if (!dateKey) continue;

    const slotMinutes = randInt(startMin, maxStart);
    const time = minutesToTime(slotMinutes);
    const scheduledStart = buildScheduled(dateKey, time);
    const service = pick(services);
    const durationMinutes = getServiceDurationMinutes(service);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);

    const status = weightedStatus();
    const otp = null;
    const number = `09${randInt(100000000, 999999999)}`;

    const firstName = pick(['John', 'Maria', 'Ali', 'Sara', 'David', 'Layla', 'Omar', 'Nina', 'Chen', 'Priya']);
    const lastName = pick(['Smith', 'Garcia', 'Hassan', 'Nguyen', 'Brown', 'Khan', 'Patel', 'Kim', 'Martin', 'Wilson']);
    const middleInitial = pick(['A', 'B', 'C', 'D', '', '']);

    appointments.push({
      serialNumber: null,
      number,
      lastName,
      firstName,
      middleInitial: middleInitial || '',
      service,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(1, 999)}@example.com`,
      notes: `[FAKE] Demo data ${i}`,
      date: new Date(dateKey + 'T00:00:00'),
      dateKey,
      time,
      durationMinutes,
      scheduledStart,
      scheduledEnd,
      status,
      otp,
      otpExpires: null,
      verifiedAt: scheduledStart,
      isWalkIn: Math.random() < 0.3,
      historyOtp: null,
      historyOtpExpires: null,
    });
  }

  await Appointment.bulkCreate(appointments);

  const counterId = 'appointmentSerial';
  const counter = await Counter.findByPk(counterId);
  if (!counter) {
    await Counter.create({ id: counterId, seq: appointments.length + 1 });
  } else {
    await counter.update({ seq: counter.seq + appointments.length + 1 });
  }

  console.log(`Seeded ${appointments.length} fake appointments.`);
  await disconnectDatabase();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
